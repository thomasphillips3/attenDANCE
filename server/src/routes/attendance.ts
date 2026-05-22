import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Attendance routes
 *
 * GET /sessions/:id/roster — returns enrolled students for a class session,
 * with their current attendance status for that session.
 *
 * Security (T-02-01): before returning any data, the route verifies that the
 * session belongs to the requesting organization. A session from a different
 * org returns HTTP 403. organizationId always comes from JWT app_metadata via
 * request.organizationId — never from the request body or query params.
 */
const attendanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/sessions/:id/roster', async (request, reply) => {
    const organizationId = request.organizationId
    const sessionId = request.params.id

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // T-02-01: verify session belongs to this organization before returning data
    const { data: sessionCheck, error: sessionError } = await fastify.supabase
      .from('class_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (sessionError) {
      fastify.log.error({ error: sessionError }, 'Failed to verify session ownership')
      return reply.code(500).send({ error: 'Failed to load roster' })
    }

    if (!sessionCheck) {
      // Session does not exist for this org — return 403 to avoid leaking
      // whether the session exists at all (IDOR mitigation)
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Fetch roster via SECURITY DEFINER function (same SQL as Plan 02 interfaces block)
    const { data, error } = await fastify.supabase.rpc('get_session_roster', {
      p_organization_id: organizationId,
      p_session_id: sessionId,
    })

    if (error) {
      fastify.log.error({ error }, 'Failed to load roster')
      return reply.code(500).send({ error: 'Failed to load roster' })
    }

    return reply.code(200).send(data ?? [])
  })
}

export default fp(attendanceRoutes, {
  name: 'attendance',
  dependencies: ['supabase', 'auth'],
})
