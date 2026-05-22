import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type {
  CreateTuitionPlanBody,
  UpdateTuitionPlanBody,
  CreateDiscountBody,
  UpdateDiscountBody,
} from '../types/index.js'

/**
 * Billing routes -- tuition plan and discount CRUD.
 *
 * Every handler enforces:
 * - Admin role gate: request.role !== 'admin' -> 403
 * - Organization scope: organization_id from JWT on every query
 *
 * Tuition plans are per-class pricing configs (monthly, per_session, seasonal).
 * Discounts apply to a family or class (sibling, scholarship, staff).
 *
 * Soft-delete pattern: DELETE sets active=false rather than removing rows,
 * preserving billing history for audit.
 */
const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // TUITION PLANS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // GET /tuition-plans -- list tuition plans, optional ?classId filter
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: { classId?: string } }>(
    '/tuition-plans',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      let query = fastify.supabase
        .from('tuition_plans')
        .select('*, classes:class_id(id, name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      const { classId } = request.query
      if (classId) {
        query = query.eq('class_id', classId)
      }

      const { data, error } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load tuition plans')
        return reply.code(500).send({ error: 'Failed to load tuition plans' })
      }

      return reply.code(200).send({ data: data ?? [] })
    }
  )

  // ---------------------------------------------------------------------------
  // GET /tuition-plans/:id -- single tuition plan detail
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/tuition-plans/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const planId = request.params.id

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { data, error } = await fastify.supabase
        .from('tuition_plans')
        .select('*, classes:class_id(id, name)')
        .eq('id', planId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (error) {
        fastify.log.error({ error }, 'Failed to load tuition plan')
        return reply.code(500).send({ error: 'Failed to load tuition plan' })
      }
      if (!data) {
        return reply.code(404).send({ error: 'Tuition plan not found' })
      }

      return reply.code(200).send(data)
    }
  )

  // ---------------------------------------------------------------------------
  // POST /tuition-plans -- create a new tuition plan (admin only)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: CreateTuitionPlanBody }>(
    '/tuition-plans',
    async (request, reply) => {
      const organizationId = request.organizationId
      const body = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify class belongs to this org if classId is provided
      if (body.classId) {
        const { data: classRow, error: classError } = await fastify.supabase
          .from('classes')
          .select('id')
          .eq('id', body.classId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (classError) {
          fastify.log.error({ error: classError }, 'Failed to verify class')
          return reply.code(500).send({ error: 'Failed to verify class' })
        }
        if (!classRow) {
          return reply.code(400).send({ error: 'Class not found in this organization' })
        }
      }

      const { data, error } = await fastify.supabase
        .from('tuition_plans')
        .insert({
          organization_id: organizationId,
          class_id: body.classId ?? null,
          amount: body.amount,
          interval: body.interval,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create tuition plan')
        return reply.code(500).send({ error: 'Failed to create tuition plan' })
      }

      return reply.code(201).send(data)
    }
  )

  // ---------------------------------------------------------------------------
  // PATCH /tuition-plans/:id -- update a tuition plan (admin only)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: UpdateTuitionPlanBody }>(
    '/tuition-plans/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const planId = request.params.id
      const body = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify plan belongs to this org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('tuition_plans')
        .select('id')
        .eq('id', planId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify tuition plan')
        return reply.code(500).send({ error: 'Failed to verify tuition plan' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Tuition plan not found' })
      }

      // If updating classId, verify class belongs to org
      if (body.classId) {
        const { data: classRow, error: classError } = await fastify.supabase
          .from('classes')
          .select('id')
          .eq('id', body.classId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (classError) {
          fastify.log.error({ error: classError }, 'Failed to verify class')
          return reply.code(500).send({ error: 'Failed to verify class' })
        }
        if (!classRow) {
          return reply.code(400).send({ error: 'Class not found in this organization' })
        }
      }

      // Build update object from present body fields
      const changes: Record<string, unknown> = {}
      if (body.classId !== undefined) changes.class_id = body.classId
      if (body.amount !== undefined) changes.amount = body.amount
      if (body.interval !== undefined) changes.interval = body.interval
      if (body.active !== undefined) changes.active = body.active

      if (Object.keys(changes).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' })
      }

      const { data, error } = await fastify.supabase
        .from('tuition_plans')
        .update(changes)
        .eq('id', planId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update tuition plan')
        return reply.code(500).send({ error: 'Failed to update tuition plan' })
      }

      return reply.code(200).send(data)
    }
  )

  // ---------------------------------------------------------------------------
  // DELETE /tuition-plans/:id -- soft delete (set active=false), admin only
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/tuition-plans/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const planId = request.params.id

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { data: existing, error: checkError } = await fastify.supabase
        .from('tuition_plans')
        .select('id, active')
        .eq('id', planId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify tuition plan')
        return reply.code(500).send({ error: 'Failed to verify tuition plan' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Tuition plan not found' })
      }

      if (!existing.active) {
        return reply.code(200).send({ message: 'Tuition plan already deactivated' })
      }

      const { error } = await fastify.supabase
        .from('tuition_plans')
        .update({ active: false })
        .eq('id', planId)
        .eq('organization_id', organizationId)

      if (error) {
        fastify.log.error({ error }, 'Failed to deactivate tuition plan')
        return reply.code(500).send({ error: 'Failed to deactivate tuition plan' })
      }

      return reply.code(200).send({ message: 'Tuition plan deactivated' })
    }
  )

  // ===========================================================================
  // DISCOUNTS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // GET /discounts -- list discounts, optional ?familyId and ?classId filters
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: { familyId?: string; classId?: string } }>(
    '/discounts',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      let query = fastify.supabase
        .from('discounts')
        .select('*, families:family_id(id, primary_guardian_name), classes:class_id(id, name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      const { familyId, classId } = request.query
      if (familyId) {
        query = query.eq('family_id', familyId)
      }
      if (classId) {
        query = query.eq('class_id', classId)
      }

      const { data, error } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load discounts')
        return reply.code(500).send({ error: 'Failed to load discounts' })
      }

      return reply.code(200).send({ data: data ?? [] })
    }
  )

  // ---------------------------------------------------------------------------
  // POST /discounts -- create a new discount (admin only)
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: CreateDiscountBody }>(
    '/discounts',
    async (request, reply) => {
      const organizationId = request.organizationId
      const body = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // DB constraint: must have family_id or class_id (or both)
      if (!body.familyId && !body.classId) {
        return reply.code(400).send({ error: 'Discount must target a family or class (or both)' })
      }

      // DB constraint: must have amount XOR percent
      if (body.amount !== undefined && body.percent !== undefined) {
        return reply.code(400).send({ error: 'Discount must have amount or percent, not both' })
      }
      if (body.amount === undefined && body.percent === undefined) {
        return reply.code(400).send({ error: 'Discount must have either amount or percent' })
      }

      // Verify family belongs to org if provided
      if (body.familyId) {
        const { data: familyRow, error: familyError } = await fastify.supabase
          .from('families')
          .select('id')
          .eq('id', body.familyId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (familyError) {
          fastify.log.error({ error: familyError }, 'Failed to verify family')
          return reply.code(500).send({ error: 'Failed to verify family' })
        }
        if (!familyRow) {
          return reply.code(400).send({ error: 'Family not found in this organization' })
        }
      }

      // Verify class belongs to org if provided
      if (body.classId) {
        const { data: classRow, error: classError } = await fastify.supabase
          .from('classes')
          .select('id')
          .eq('id', body.classId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (classError) {
          fastify.log.error({ error: classError }, 'Failed to verify class')
          return reply.code(500).send({ error: 'Failed to verify class' })
        }
        if (!classRow) {
          return reply.code(400).send({ error: 'Class not found in this organization' })
        }
      }

      const { data, error } = await fastify.supabase
        .from('discounts')
        .insert({
          organization_id: organizationId,
          family_id: body.familyId ?? null,
          class_id: body.classId ?? null,
          type: body.type,
          amount: body.amount ?? null,
          percent: body.percent ?? null,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create discount')
        return reply.code(500).send({ error: 'Failed to create discount' })
      }

      return reply.code(201).send(data)
    }
  )

  // ---------------------------------------------------------------------------
  // PATCH /discounts/:id -- update a discount (admin only)
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: UpdateDiscountBody }>(
    '/discounts/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const discountId = request.params.id
      const body = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify discount belongs to this org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('discounts')
        .select('id')
        .eq('id', discountId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify discount')
        return reply.code(500).send({ error: 'Failed to verify discount' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Discount not found' })
      }

      // Build update object from present body fields
      const changes: Record<string, unknown> = {}
      if (body.familyId !== undefined) changes.family_id = body.familyId
      if (body.classId !== undefined) changes.class_id = body.classId
      if (body.type !== undefined) changes.type = body.type
      if (body.amount !== undefined) changes.amount = body.amount
      if (body.percent !== undefined) changes.percent = body.percent
      if (body.active !== undefined) changes.active = body.active

      if (Object.keys(changes).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' })
      }

      const { data, error } = await fastify.supabase
        .from('discounts')
        .update(changes)
        .eq('id', discountId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update discount')
        return reply.code(500).send({ error: 'Failed to update discount' })
      }

      return reply.code(200).send(data)
    }
  )

  // ---------------------------------------------------------------------------
  // DELETE /discounts/:id -- soft delete (set active=false), admin only
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/discounts/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const discountId = request.params.id

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { data: existing, error: checkError } = await fastify.supabase
        .from('discounts')
        .select('id, active')
        .eq('id', discountId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify discount')
        return reply.code(500).send({ error: 'Failed to verify discount' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Discount not found' })
      }

      if (!existing.active) {
        return reply.code(200).send({ message: 'Discount already deactivated' })
      }

      const { error } = await fastify.supabase
        .from('discounts')
        .update({ active: false })
        .eq('id', discountId)
        .eq('organization_id', organizationId)

      if (error) {
        fastify.log.error({ error }, 'Failed to deactivate discount')
        return reply.code(500).send({ error: 'Failed to deactivate discount' })
      }

      return reply.code(200).send({ message: 'Discount deactivated' })
    }
  )
}

export default fp(billingRoutes, {
  name: 'billing',
  dependencies: ['supabase', 'auth'],
})
