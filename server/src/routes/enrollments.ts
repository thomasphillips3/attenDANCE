import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { EnrollBody, TransferBody } from '../types/index.js'
import { sendEmail } from '../lib/notifications.js'
import { enrollmentConfirmation } from '../lib/email-templates.js'

/**
 * Enrollment routes -- enroll, drop, and transfer students between classes.
 *
 * Every handler enforces:
 * - Admin role gate (T-02-13): request.role !== 'admin' -> 403
 * - Organization scope: organization_id from JWT on every operation
 *
 * Enrollment and transfer use Postgres RPC functions (Plan 02-01) that handle
 * capacity enforcement, waitlisting, and atomic operations. The promote_from_waitlist
 * trigger fires automatically on drop operations.
 */
const enrollmentRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------------------
  // POST /enrollments -- enroll a student in a class
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: EnrollBody }>('/enrollments', async (request, reply) => {
    const organizationId = request.organizationId

    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const { studentId, classId } = request.body

    const { data, error } = await fastify.supabase.rpc('enroll_student', {
      p_organization_id: organizationId,
      p_student_id: studentId,
      p_class_id: classId,
    })

    if (error) {
      fastify.log.error({ error }, 'Failed to enroll student')
      return reply.code(500).send({ error: 'Failed to enroll student' })
    }

    // The RPC returns a single jsonb value. If it contains an 'error' key,
    // the Postgres function rejected the operation (class not found, already enrolled, etc.)
    if (typeof data === 'object' && data !== null && 'error' in data) {
      return reply.code(409).send({ error: (data as Record<string, string>).error })
    }

    // Fire-and-forget: send enrollment confirmation email (COMM-01)
    // Don't await -- email delivery should not block the API response
    ;(async () => {
      try {
        // Look up student name, family email, and class name for the email
        const { data: student } = await fastify.supabase
          .from('students')
          .select('first_name, last_name, family_id')
          .eq('id', studentId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (!student?.family_id) return

        const { data: family } = await fastify.supabase
          .from('families')
          .select('id, email, primary_guardian_name')
          .eq('id', student.family_id)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (!family?.email) return

        const { data: classRow } = await fastify.supabase
          .from('classes')
          .select('name')
          .eq('id', classId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        const studentName = `${student.first_name} ${student.last_name}`
        const className = classRow?.name ?? 'class'
        const studioName = "LaShelle's School of Dance"

        await sendEmail(fastify.supabase, {
          organizationId: organizationId!,
          familyId: family.id,
          studentId,
          to: family.email,
          subject: `Welcome to ${className}!`,
          html: enrollmentConfirmation(studentName, className, studioName),
          templateKey: 'enrollment_confirmation',
          payload: { studentName, className, studioName },
        }, fastify.log)
      } catch (err) {
        fastify.log.error({ error: err }, 'Failed to send enrollment confirmation email')
      }
    })()

    return reply.code(201).send(data)
  })

  // ---------------------------------------------------------------------------
  // DELETE /enrollments/:id -- drop a student from a class
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/enrollments/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const enrollmentId = request.params.id

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // T-02-15: Verify enrollment exists and belongs to this org before dropping
      const { data: enrollment, error: fetchError } = await fastify.supabase
        .from('enrollments')
        .select('id, status, organization_id')
        .eq('id', enrollmentId)
        .maybeSingle()

      if (fetchError) {
        fastify.log.error({ error: fetchError }, 'Failed to fetch enrollment')
        return reply.code(500).send({ error: 'Failed to fetch enrollment' })
      }

      if (!enrollment || enrollment.organization_id !== organizationId) {
        return reply.code(404).send({ error: 'Enrollment not found' })
      }

      if (enrollment.status === 'dropped') {
        return reply.code(409).send({ error: 'Student already dropped' })
      }

      // Set status to 'dropped' -- the promote_from_waitlist trigger fires automatically
      const { error: updateError } = await fastify.supabase
        .from('enrollments')
        .update({
          status: 'dropped',
          dropped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId)
        .eq('organization_id', organizationId)

      if (updateError) {
        fastify.log.error({ error: updateError }, 'Failed to drop student')
        return reply.code(500).send({ error: 'Failed to drop student' })
      }

      return reply.code(200).send({
        message: 'Student dropped',
        enrollmentId,
      })
    }
  )

  // ---------------------------------------------------------------------------
  // POST /enrollments/transfer -- transfer a student between classes
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: TransferBody }>(
    '/enrollments/transfer',
    async (request, reply) => {
      const organizationId = request.organizationId

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const { studentId, fromClassId, toClassId } = request.body

      const { data, error } = await fastify.supabase.rpc('transfer_student', {
        p_organization_id: organizationId,
        p_student_id: studentId,
        p_from_class_id: fromClassId,
        p_to_class_id: toClassId,
      })

      if (error) {
        fastify.log.error({ error }, 'Failed to transfer student')
        return reply.code(500).send({ error: 'Failed to transfer student' })
      }

      // Check for application-level error from the Postgres function
      if (typeof data === 'object' && data !== null && 'error' in data) {
        return reply.code(409).send({ error: (data as Record<string, string>).error })
      }

      return reply.code(200).send(data)
    }
  )
}

export default fp(enrollmentRoutes, {
  name: 'enrollments',
  dependencies: ['supabase', 'auth'],
})
