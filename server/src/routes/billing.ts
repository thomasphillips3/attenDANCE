import fp from 'fastify-plugin'
import Stripe from 'stripe'
import type { FastifyPluginAsync } from 'fastify'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateTuitionPlanBody,
  UpdateTuitionPlanBody,
  CreateDiscountBody,
  UpdateDiscountBody,
  GenerateInvoiceBody,
  InvoiceListQuery,
  UpdateInvoiceBody,
  RecordPaymentBody,
  PaymentListQuery,
} from '../types/index.js'

// Stripe client -- initialized lazily. STRIPE_SECRET_KEY must be set in
// production; missing key is a startup error only when a Stripe route is hit.
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY env var is required for billing routes')
    }
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

/**
 * ensureStripeCustomer -- look up a family's stripe_customer_id, or create a
 * new Stripe Customer and persist the ID on the families row.
 *
 * Returns the stripe_customer_id (always non-null on success).
 */
async function ensureStripeCustomer(
  supabase: SupabaseClient,
  familyId: string,
  organizationId: string,
): Promise<string> {
  // Fetch the family row
  const { data: family, error: fetchError } = await supabase
    .from('families')
    .select('id, primary_guardian_name, email, stripe_customer_id')
    .eq('id', familyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!family) throw new Error('Family not found')

  // If already has a Stripe Customer, return it
  if (family.stripe_customer_id) {
    return family.stripe_customer_id
  }

  // Create Stripe Customer
  const stripe = getStripe()
  const customer = await stripe.customers.create({
    name: family.primary_guardian_name,
    email: family.email,
    metadata: {
      family_id: familyId,
      organization_id: organizationId,
    },
  })

  // Save stripe_customer_id to families table
  const { error: updateError } = await supabase
    .from('families')
    .update({ stripe_customer_id: customer.id })
    .eq('id', familyId)
    .eq('organization_id', organizationId)

  if (updateError) throw updateError

  return customer.id
}

/**
 * Billing routes -- tuition plan and discount CRUD, invoice generation,
 * manual payment recording, and Stripe customer auto-creation.
 *
 * Every handler enforces:
 * - Admin role gate: request.role !== 'admin' -> 403
 * - Organization scope: organization_id from JWT on every query
 *
 * Tuition plans are per-class pricing configs (monthly, per_session, seasonal).
 * Discounts apply to a family or class (sibling, scholarship, staff).
 * Invoices are generated from enrollments + tuition plans with discount calculation.
 * Payments record cash/check collections against invoices.
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

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // POST /invoices/generate -- generate an invoice for a family (admin only)
  //
  // Looks up all active enrollments for the family, finds the active tuition
  // plan for each enrolled class, sums amounts, applies applicable discounts,
  // and creates an invoice row. Also ensures a Stripe Customer exists for the
  // family (auto-creates one if missing).
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: GenerateInvoiceBody }>(
    '/invoices/generate',
    async (request, reply) => {
      const organizationId = request.organizationId
      const { familyId } = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // 1. Look up all active enrollments for students in this family
      //    Join: enrollments -> students (to filter by family) -> classes -> tuition_plans
      const { data: enrollments, error: enrollError } = await fastify.supabase
        .from('enrollments')
        .select(`
          id,
          class_id,
          students!inner(id, family_id),
          classes!inner(id, name)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .eq('students.family_id', familyId)

      if (enrollError) {
        fastify.log.error({ error: enrollError }, 'Failed to look up enrollments')
        return reply.code(500).send({ error: 'Failed to look up enrollments' })
      }

      if (!enrollments || enrollments.length === 0) {
        return reply.code(400).send({ error: 'No active enrollments found for this family' })
      }

      // 2. For each enrollment, find the active tuition plan for that class
      const classIds = [...new Set(enrollments.map((e) => e.class_id))]
      const { data: tuitionPlans, error: planError } = await fastify.supabase
        .from('tuition_plans')
        .select('id, class_id, amount')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .in('class_id', classIds)

      if (planError) {
        fastify.log.error({ error: planError }, 'Failed to look up tuition plans')
        return reply.code(500).send({ error: 'Failed to look up tuition plans' })
      }

      // Build a map of class_id -> tuition plan amount
      const planByClass = new Map<string, number>()
      for (const plan of tuitionPlans ?? []) {
        if (plan.class_id) {
          planByClass.set(plan.class_id, Number(plan.amount))
        }
      }

      // Sum tuition amounts across all enrolled classes
      let totalAmount = 0
      for (const enrollment of enrollments) {
        const planAmount = planByClass.get(enrollment.class_id)
        if (planAmount !== undefined) {
          totalAmount += planAmount
        }
      }

      if (totalAmount <= 0) {
        return reply.code(400).send({
          error: 'No tuition plans found for enrolled classes',
        })
      }

      // 3. Look up active discounts for this family and apply them
      const { data: discounts, error: discountError } = await fastify.supabase
        .from('discounts')
        .select('id, family_id, class_id, type, amount, percent')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .or(`family_id.eq.${familyId},class_id.in.(${classIds.join(',')})`)

      if (discountError) {
        fastify.log.error({ error: discountError }, 'Failed to look up discounts')
        return reply.code(500).send({ error: 'Failed to look up discounts' })
      }

      let discountTotal = 0
      for (const disc of discounts ?? []) {
        if (disc.amount !== null) {
          discountTotal += Number(disc.amount)
        } else if (disc.percent !== null) {
          discountTotal += totalAmount * (Number(disc.percent) / 100)
        }
      }

      // Final amount cannot go below zero
      const finalAmount = Math.max(0, Math.round((totalAmount - discountTotal) * 100) / 100)

      // 4. Calculate due date: first of next month
      const now = new Date()
      const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const dueDateStr = dueDate.toISOString().split('T')[0]

      // 5. Ensure Stripe Customer exists for the family
      try {
        await ensureStripeCustomer(fastify.supabase, familyId, organizationId)
      } catch (stripeErr) {
        fastify.log.error({ error: stripeErr }, 'Failed to create Stripe customer')
        // Non-blocking: invoice still gets created even if Stripe customer fails.
        // The customer can be created later when Stripe payment is attempted.
      }

      // 6. Create invoice row
      const { data: invoice, error: invoiceError } = await fastify.supabase
        .from('invoices')
        .insert({
          organization_id: organizationId,
          family_id: familyId,
          amount: finalAmount,
          due_date: dueDateStr,
          status: 'pending',
        })
        .select()
        .single()

      if (invoiceError) {
        fastify.log.error({ error: invoiceError }, 'Failed to create invoice')
        return reply.code(500).send({ error: 'Failed to create invoice' })
      }

      return reply.code(201).send(invoice)
    }
  )

  // ---------------------------------------------------------------------------
  // GET /invoices -- list invoices, org-scoped with optional filters
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: InvoiceListQuery }>(
    '/invoices',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin' && request.role !== 'front_desk') {
        return reply.code(403).send({ error: 'Admin or front desk role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { familyId, status, page = 1, limit = 25 } = request.query
      const offset = (page - 1) * limit

      let query = fastify.supabase
        .from('invoices')
        .select('*, families:family_id(id, primary_guardian_name, email)', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('due_date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (familyId) {
        query = query.eq('family_id', familyId)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load invoices')
        return reply.code(500).send({ error: 'Failed to load invoices' })
      }

      return reply.code(200).send({
        data: data ?? [],
        total: count ?? 0,
        page,
        limit,
      })
    }
  )

  // ---------------------------------------------------------------------------
  // GET /invoices/:id -- invoice detail with payment history
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/invoices/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const invoiceId = request.params.id

      if (request.role !== 'admin' && request.role !== 'front_desk') {
        return reply.code(403).send({ error: 'Admin or front desk role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { data: invoice, error: invoiceError } = await fastify.supabase
        .from('invoices')
        .select('*, families:family_id(id, primary_guardian_name, email)')
        .eq('id', invoiceId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (invoiceError) {
        fastify.log.error({ error: invoiceError }, 'Failed to load invoice')
        return reply.code(500).send({ error: 'Failed to load invoice' })
      }
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      // Fetch associated payments
      const { data: payments, error: payError } = await fastify.supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('organization_id', organizationId)
        .order('paid_at', { ascending: false })

      if (payError) {
        fastify.log.error({ error: payError }, 'Failed to load payments')
        return reply.code(500).send({ error: 'Failed to load payments' })
      }

      return reply.code(200).send({
        ...invoice,
        payments: payments ?? [],
      })
    }
  )

  // ---------------------------------------------------------------------------
  // PATCH /invoices/:id -- update invoice status (waive), admin only
  // Only allows: pending -> waived, overdue -> waived
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: UpdateInvoiceBody }>(
    '/invoices/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const invoiceId = request.params.id
      const { status: newStatus } = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify invoice exists and check current status
      const { data: existing, error: checkError } = await fastify.supabase
        .from('invoices')
        .select('id, status')
        .eq('id', invoiceId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify invoice')
        return reply.code(500).send({ error: 'Failed to verify invoice' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      // Only allow pending -> waived or overdue -> waived
      if (existing.status !== 'pending' && existing.status !== 'overdue') {
        return reply.code(400).send({
          error: `Cannot waive an invoice with status '${existing.status}'. Only pending or overdue invoices can be waived.`,
        })
      }

      const { data, error } = await fastify.supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update invoice')
        return reply.code(500).send({ error: 'Failed to update invoice' })
      }

      return reply.code(200).send(data)
    }
  )

  // ===========================================================================
  // PAYMENTS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // POST /payments -- record a manual payment (admin + front_desk)
  //
  // Creates a payment row linked to an invoice. If total payments for the
  // invoice meet or exceed the invoice amount, automatically updates the
  // invoice status to 'paid'.
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: RecordPaymentBody }>(
    '/payments',
    async (request, reply) => {
      const organizationId = request.organizationId
      const { invoiceId, amount, method, notes } = request.body

      if (request.role !== 'admin' && request.role !== 'front_desk') {
        return reply.code(403).send({ error: 'Admin or front desk role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify invoice exists and belongs to org
      const { data: invoice, error: invoiceCheck } = await fastify.supabase
        .from('invoices')
        .select('id, amount, status')
        .eq('id', invoiceId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (invoiceCheck) {
        fastify.log.error({ error: invoiceCheck }, 'Failed to verify invoice')
        return reply.code(500).send({ error: 'Failed to verify invoice' })
      }
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      if (invoice.status === 'paid') {
        return reply.code(400).send({ error: 'Invoice is already paid' })
      }
      if (invoice.status === 'waived') {
        return reply.code(400).send({ error: 'Cannot record payment on a waived invoice' })
      }

      // Insert payment row
      const { data: payment, error: payError } = await fastify.supabase
        .from('payments')
        .insert({
          organization_id: organizationId,
          invoice_id: invoiceId,
          amount,
          method,
          paid_at: new Date().toISOString(),
          notes: notes ?? null,
        })
        .select()
        .single()

      if (payError) {
        fastify.log.error({ error: payError }, 'Failed to record payment')
        return reply.code(500).send({ error: 'Failed to record payment' })
      }

      // Check if total payments now cover the invoice amount
      const { data: allPayments, error: sumError } = await fastify.supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoiceId)
        .eq('organization_id', organizationId)

      if (!sumError && allPayments) {
        const totalPaid = allPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        )
        if (totalPaid >= Number(invoice.amount)) {
          await fastify.supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoiceId)
            .eq('organization_id', organizationId)
        }
      }

      return reply.code(201).send(payment)
    }
  )

  // ---------------------------------------------------------------------------
  // GET /payments -- list payments, org-scoped with optional filters
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: PaymentListQuery }>(
    '/payments',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin' && request.role !== 'front_desk') {
        return reply.code(403).send({ error: 'Admin or front desk role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { invoiceId, familyId, page = 1, limit = 25 } = request.query
      const offset = (page - 1) * limit

      let query = fastify.supabase
        .from('payments')
        .select('*, invoices:invoice_id(id, family_id, amount, status, due_date)', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('paid_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (invoiceId) {
        query = query.eq('invoice_id', invoiceId)
      }

      // Filter by familyId through the invoice join
      if (familyId) {
        query = query.eq('invoices.family_id', familyId)
      }

      const { data, error, count } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load payments')
        return reply.code(500).send({ error: 'Failed to load payments' })
      }

      return reply.code(200).send({
        data: data ?? [],
        total: count ?? 0,
        page,
        limit,
      })
    }
  )
}

export default fp(billingRoutes, {
  name: 'billing',
  dependencies: ['supabase', 'auth'],
})
