import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { InviteBody } from '../types/index.js'

/**
 * Auth routes
 *
 * POST /auth/invite — admin-only endpoint to invite a new staff member by email.
 *
 * Five-step contract (T-04-01 mitigation):
 * 1. If request.role !== 'admin': return 403 { error: 'Admin role required' }
 * 2. Validate body with TypeBox schema (email + role)
 * 3. Call fastify.supabase.auth.admin.inviteUserByEmail to send the invitation
 * 4. Return 200 { message: 'Invitation sent', email }
 * 5. On Supabase error: return 500 { error: error.message }
 *
 * Security (T-04-01): Role gate is the first check after auth. Admin role lives
 * in app_metadata (server-writable only via Auth Hook) — cannot be self-assigned
 * by a user editing user_metadata.
 *
 * inviteUserByEmail is called with the service role client (fastify.supabase) —
 * never from the browser directly.
 */
const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: InviteBody }>('/auth/invite', async (request, reply) => {
    // Step 1: role gate — admin only (T-04-01)
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    // Step 2: validate body
    const { email, role } = request.body
    if (!email || !role) {
      return reply.code(400).send({ error: 'email and role are required' })
    }

    const validRoles = ['admin', 'instructor', 'front_desk'] as const
    if (!validRoles.includes(role)) {
      return reply.code(400).send({ error: 'role must be admin, instructor, or front_desk' })
    }

    // Step 3: send invitation via Supabase Auth admin API (service role only)
    const { error } = await fastify.supabase.auth.admin.inviteUserByEmail(email, {
      data: { invited: true },
    })

    if (error) {
      fastify.log.error({ error }, 'Failed to send staff invitation')
      return reply.code(500).send({ error: error.message })
    }

    // Step 4: return success
    return reply.code(200).send({ message: 'Invitation sent', email })
  })
}

export default fp(authRoutes, {
  name: 'auth-routes',
  dependencies: ['supabase', 'auth'],
})
