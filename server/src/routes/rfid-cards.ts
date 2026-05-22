import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { CreateRfidCardBody } from '../types/index.js'

/**
 * RFID Card management routes (Plan 02-02)
 *
 * Admin CRUD for assigning/removing RFID card UIDs to students.
 * Separate from the Phase 1 /rfid/checkin stub (rfid.ts) which handles
 * hardware check-in — this file manages the card-to-student mapping.
 *
 * card_uid has a UNIQUE constraint in the database (T-02-09).
 * Duplicate assignments return 409.
 */
const rfidCardsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /rfid-cards — list active RFID cards for a student.
   * Requires studentId query parameter.
   */
  fastify.get<{ Querystring: { studentId?: string } }>(
    '/rfid-cards',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const studentId = (request.query as { studentId?: string }).studentId
      if (!studentId) {
        return reply.code(400).send({ error: 'studentId query parameter is required' })
      }

      const { data, error } = await fastify.supabase
        .from('rfid_cards')
        .select('*')
        .eq('student_id', studentId)
        .eq('organization_id', organizationId)
        .eq('active', true)

      if (error) {
        fastify.log.error({ error }, 'Failed to load RFID cards')
        return reply.code(500).send({ error: 'Failed to load RFID cards' })
      }

      return reply.code(200).send(data ?? [])
    }
  )

  /**
   * POST /rfid-cards — assign an RFID card to a student.
   * Verifies student belongs to org. card_uid UNIQUE constraint
   * catches duplicates (T-02-09).
   */
  fastify.post<{ Body: CreateRfidCardBody }>(
    '/rfid-cards',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const body = request.body as CreateRfidCardBody

      // Verify student belongs to this organization
      const { data: student, error: studentError } = await fastify.supabase
        .from('students')
        .select('id')
        .eq('id', body.studentId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (studentError) {
        fastify.log.error({ error: studentError }, 'Failed to verify student for RFID')
        return reply.code(500).send({ error: 'Failed to assign RFID card' })
      }

      if (!student) {
        return reply.code(400).send({ error: 'Student not found in this organization' })
      }

      const { data: card, error } = await fastify.supabase
        .from('rfid_cards')
        .insert({
          organization_id: organizationId,
          student_id: body.studentId,
          card_uid: body.cardUid,
          issued_at: new Date().toISOString(),
          active: true,
        })
        .select()
        .single()

      if (error) {
        // Postgres unique violation on card_uid
        if (error.code === '23505') {
          return reply
            .code(409)
            .send({ error: 'Card UID already assigned to another student' })
        }
        fastify.log.error({ error }, 'Failed to assign RFID card')
        return reply.code(500).send({ error: 'Failed to assign RFID card' })
      }

      return reply.code(201).send(card)
    }
  )

  /**
   * DELETE /rfid-cards/:id — soft-delete (deactivate) an RFID card.
   * Sets active = false rather than removing the row.
   */
  fastify.delete<{ Params: { id: string } }>(
    '/rfid-cards/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const { data, error } = await fastify.supabase
        .from('rfid_cards')
        .update({ active: false })
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .select('id')

      if (error) {
        fastify.log.error({ error }, 'Failed to deactivate RFID card')
        return reply.code(500).send({ error: 'Failed to deactivate RFID card' })
      }

      if (!data || data.length === 0) {
        return reply.code(404).send({ error: 'RFID card not found' })
      }

      return reply.code(200).send({ message: 'Card deactivated' })
    }
  )
}

export default fp(rfidCardsRoutes, {
  name: 'rfid-cards',
  dependencies: ['supabase', 'auth'],
})
