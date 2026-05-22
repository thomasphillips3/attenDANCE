import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type {
  CreateFamilyBody,
  UpdateFamilyBody,
  FamilyListQuery,
} from '../types/index.js'

/**
 * Families CRUD routes (Plan 02-02)
 *
 * Every handler checks organizationId (401) and admin role (403).
 * All queries scoped by organization_id from JWT.
 */
const familiesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /families — paginated family list with student count.
   * Joins students to compute studentCount per family.
   */
  fastify.get<{ Querystring: FamilyListQuery }>(
    '/families',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const { page = 1, limit = 50 } = request.query as FamilyListQuery
      const safeLimit = Math.min(limit, 100)
      const from = (page - 1) * safeLimit

      const { data, count, error } = await fastify.supabase
        .from('families')
        .select('*, students(id)', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('primary_guardian_name')
        .range(from, from + safeLimit - 1)

      if (error) {
        fastify.log.error({ error }, 'Failed to load families')
        return reply.code(500).send({ error: 'Failed to load families' })
      }

      // Map to include studentCount for display
      const families = (data ?? []).map(
        (row: Record<string, unknown> & { students?: { id: string }[] }) => ({
          ...row,
          studentCount: row.students?.length ?? 0,
          students: undefined, // remove raw join data from response
        })
      )

      return reply.code(200).send({
        data: families,
        total: count ?? 0,
        page,
        limit: safeLimit,
      })
    }
  )

  /**
   * GET /families/:id — family detail with linked students.
   */
  fastify.get<{ Params: { id: string } }>(
    '/families/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const { data: family, error } = await fastify.supabase
        .from('families')
        .select(
          '*, students(id, first_name, last_name, active, photo_url)'
        )
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (error) {
        fastify.log.error({ error }, 'Failed to load family')
        return reply.code(500).send({ error: 'Failed to load family' })
      }

      if (!family) {
        return reply.code(404).send({ error: 'Family not found' })
      }

      return reply.code(200).send(family)
    }
  )

  /**
   * POST /families — create a new family.
   */
  fastify.post<{ Body: CreateFamilyBody }>(
    '/families',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const body = request.body as CreateFamilyBody

      const { data: family, error } = await fastify.supabase
        .from('families')
        .insert({
          organization_id: organizationId,
          primary_guardian_name: body.primaryGuardianName,
          email: body.email,
          phone: body.phone ?? null,
          secondary_guardian_name: body.secondaryGuardianName ?? null,
          emergency_contact_name: body.emergencyContactName ?? null,
          emergency_contact_phone: body.emergencyContactPhone ?? null,
          address: body.address ?? null,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create family')
        return reply.code(500).send({ error: 'Failed to create family' })
      }

      return reply.code(201).send(family)
    }
  )

  /**
   * PATCH /families/:id — update an existing family.
   * Verifies org ownership before update.
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateFamilyBody }>(
    '/families/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const body = request.body as UpdateFamilyBody

      // Verify family belongs to org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('families')
        .select('id')
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify family')
        return reply.code(500).send({ error: 'Failed to update family' })
      }

      if (!existing) {
        return reply.code(404).send({ error: 'Family not found' })
      }

      // Build update object from present fields only
      const changes: Record<string, unknown> = {}
      if (body.primaryGuardianName !== undefined)
        changes.primary_guardian_name = body.primaryGuardianName
      if (body.email !== undefined) changes.email = body.email
      if (body.phone !== undefined) changes.phone = body.phone
      if (body.secondaryGuardianName !== undefined)
        changes.secondary_guardian_name = body.secondaryGuardianName
      if (body.emergencyContactName !== undefined)
        changes.emergency_contact_name = body.emergencyContactName
      if (body.emergencyContactPhone !== undefined)
        changes.emergency_contact_phone = body.emergencyContactPhone
      if (body.address !== undefined) changes.address = body.address
      changes.updated_at = new Date().toISOString()

      const { data: updated, error } = await fastify.supabase
        .from('families')
        .update(changes)
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update family')
        return reply.code(500).send({ error: 'Failed to update family' })
      }

      return reply.code(200).send(updated)
    }
  )
}

export default fp(familiesRoutes, {
  name: 'families',
  dependencies: ['supabase', 'auth'],
})
