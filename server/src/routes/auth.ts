import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { InviteBody, InviteParentBody } from '../types/index.js'

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

  /**
   * POST /auth/invite-parent — admin-only endpoint to invite a parent.
   *
   * Creates a Supabase Auth user for the parent, links parent_user_id to the
   * family record, and sends a magic link email. The custom_access_token_hook
   * (migration 009) will inject role='parent' + family_id into the JWT on login.
   *
   * Security: admin role gate + organization scoping on the family lookup.
   */
  fastify.post<{ Body: InviteParentBody }>('/auth/invite-parent', async (request, reply) => {
    // Role gate — admin only
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const { familyId, email } = request.body
    if (!familyId || !email) {
      return reply.code(400).send({ error: 'familyId and email are required' })
    }

    // Verify the family exists and belongs to this organization
    const { data: family, error: familyError } = await fastify.supabase
      .from('families')
      .select('id, parent_user_id')
      .eq('id', familyId)
      .eq('organization_id', organizationId)
      .single()

    if (familyError || !family) {
      return reply.code(404).send({ error: 'Family not found' })
    }

    if (family.parent_user_id) {
      return reply.code(409).send({ error: 'This family already has a parent account linked' })
    }

    // Create the auth user and send magic link invitation
    const { data: inviteData, error: inviteError } = await fastify.supabase.auth.admin.inviteUserByEmail(email, {
      data: { invited: true, is_parent: true },
    })

    if (inviteError) {
      fastify.log.error({ error: inviteError }, 'Failed to send parent invitation')
      return reply.code(500).send({ error: inviteError.message })
    }

    // Link the new auth user to the family record
    const userId = inviteData?.user?.id
    if (userId) {
      const { error: updateError } = await fastify.supabase
        .from('families')
        .update({ parent_user_id: userId, email })
        .eq('id', familyId)
        .eq('organization_id', organizationId)

      if (updateError) {
        fastify.log.error({ error: updateError }, 'Failed to link parent user to family')
        return reply.code(500).send({ error: 'Invitation sent but failed to link to family' })
      }
    }

    return reply.code(200).send({ message: 'Parent invitation sent', email, familyId })
  })
}

export default fp(authRoutes, {
  name: 'auth-routes',
  dependencies: ['supabase', 'auth'],
})
