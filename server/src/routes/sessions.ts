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
