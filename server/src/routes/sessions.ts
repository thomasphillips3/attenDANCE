import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Sessions routes
 *
 * GET /sessions/today — returns today's class_sessions for the authenticated
 * organization, joined with class metadata and live attendance counts.
 *
 * organizationId is sourced exclusively from request.organizationId, which
 * the auth preHandler sets from JWT app_metadata. It is never read from the
 * request body or query params (T-02-01 mitigation).
 *
 * Uses supabase.rpc('get_sessions_today') which wraps the exact JOIN + aggregate
 * SQL from Plan 02 interfaces block as a SECURITY DEFINER Postgres function.
 */
const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /sessions/:id/submit — mark a class session as completed.
   *
   * Five-step contract (T-04-02 mitigation):
   * 1. SELECT organization_id FROM class_sessions WHERE id = params.id
   * 2. If no row or org mismatch: return 403
   * 3. UPDATE class_sessions SET status = 'completed', updated_at = now()
   * 4. Return 200 { sessionId, status: 'completed', submittedAt }
   * 5. DB error: return 500
   *
   * submittedAt is computed at response time — no column added to schema.
   * Repeated calls are idempotent (UPDATE on already-completed is a no-op).
   */
  fastify.post<{ Params: { id: string } }>('/sessions/:id/submit', async (request, reply) => {
    const organizationId = request.organizationId
    const sessionId = request.params.id

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // Step 1: verify session exists and belongs to this organization (T-04-02)
    const { data: sessionRow, error: selectError } = await fastify.supabase
      .from('class_sessions')
      .select('id, organization_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (selectError) {
      fastify.log.error({ error: selectError }, 'Failed to verify session for submit')
      return reply.code(500).send({ error: 'Failed to submit attendance' })
    }

    // Step 2: missing or org mismatch → 403
    if (!sessionRow || sessionRow.organization_id !== organizationId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Step 3: mark the session as completed
    const { error: updateError } = await fastify.supabase
      .from('class_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('organization_id', organizationId)

    if (updateError) {
      fastify.log.error({ error: updateError }, 'Failed to mark session completed')
      return reply.code(500).send({ error: 'Failed to submit attendance' })
    }

    // Step 4: return success with submittedAt computed at response time
    return reply.code(200).send({
      sessionId,
      status: 'completed',
      submittedAt: new Date().toISOString(),
    })
  })

  fastify.get('/sessions/today', async (request, reply) => {
    const organizationId = request.organizationId

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const { data, error } = await fastify.supabase.rpc('get_sessions_today', {
      p_organization_id: organizationId,
    })

    if (error) {
      fastify.log.error({ error }, 'Failed to load sessions')
      return reply.code(500).send({ error: 'Failed to load sessions' })
    }

    // Coerce bigint counts (returned as strings by some Postgres drivers) to numbers
    const sessions = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      presentCount: Number(row.presentCount),
      totalEnrolled: Number(row.totalEnrolled),
    }))

    return reply.code(200).send(sessions)
  })
}

export default fp(sessionsRoutes, {
  name: 'sessions',
  dependencies: ['supabase', 'auth'],
})
