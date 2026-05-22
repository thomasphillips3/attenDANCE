import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { UpdateParentProfileBody, ParentAttendanceQuery } from '../types/index.js'

/**
 * Parent Portal API routes (Plan 04-03, T-04-03-02)
 *
 * All routes require role='parent' and scope queries to family_id from JWT.
 * Parents can only see their own family's data — family_id comes from
 * app_metadata in the JWT (injected by custom_access_token_hook), never
 * from request parameters.
 *
 * Security invariant: every handler checks request.role === 'parent' AND
 * request.familyId is present before proceeding. All DB queries filter by
 * both organization_id AND family_id from the JWT.
 */
const parentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Shared guard — extracts and validates parent claims from JWT.
   * Returns { organizationId, familyId } or sends 401/403 and returns null.
   */
  async function requireParent(request: any, reply: any): Promise<{ organizationId: string; familyId: string } | null> {
    const organizationId = request.organizationId
    const familyId = request.familyId
    const role = request.role

    if (!organizationId) {
      reply.code(401).send({ error: 'Missing organization context' })
      return null
    }

    if (role !== 'parent') {
      reply.code(403).send({ error: 'Parent role required' })
      return null
    }

    if (!familyId) {
      reply.code(403).send({ error: 'No family linked to this account' })
      return null
    }

    return { organizationId, familyId }
  }

  /**
   * GET /parent/dashboard — family overview with enrolled students and classes.
   *
   * Returns the family record plus each student with their active enrollments
   * and class details. This is the parent's landing page data.
   */
  fastify.get('/parent/dashboard', async (request, reply) => {
    const ctx = await requireParent(request, reply)
    if (!ctx) return

    // Fetch family info
    const { data: family, error: familyError } = await fastify.supabase
      .from('families')
      .select('id, primary_guardian_name, secondary_guardian_name, email, phone')
      .eq('id', ctx.familyId)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (familyError || !family) {
      return reply.code(404).send({ error: 'Family not found' })
    }

    // Fetch students belonging to this family
    const { data: students, error: studentsError } = await fastify.supabase
      .from('students')
      .select('id, first_name, last_name, photo_url, active')
      .eq('family_id', ctx.familyId)
      .eq('organization_id', ctx.organizationId)
      .eq('active', true)
      .order('first_name')

    if (studentsError) {
      fastify.log.error({ error: studentsError }, 'Failed to load students for parent dashboard')
      return reply.code(500).send({ error: 'Failed to load students' })
    }

    // For each student, fetch their active enrollments with class details
    const studentIds = (students ?? []).map((s: { id: string }) => s.id)

    let enrollments: any[] = []
    if (studentIds.length > 0) {
      const { data: enrollData, error: enrollError } = await fastify.supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          status,
          classes (
            id,
            name,
            day_of_week,
            start_time,
            duration_minutes,
            room,
            level,
            staff:instructor_id (first_name, last_name)
          )
        `)
        .in('student_id', studentIds)
        .eq('organization_id', ctx.organizationId)
        .eq('status', 'active')

      if (enrollError) {
        fastify.log.error({ error: enrollError }, 'Failed to load enrollments for parent dashboard')
      } else {
        enrollments = enrollData ?? []
      }
    }

    // Group enrollments by student
    const studentsWithClasses = (students ?? []).map((student: any) => ({
      ...student,
      enrollments: enrollments
        .filter((e: any) => e.student_id === student.id)
        .map((e: any) => ({
          enrollment_id: e.id,
          status: e.status,
          class: e.classes,
        })),
    }))

    return reply.code(200).send({
      family,
      students: studentsWithClasses,
    })
  })

  /**
   * GET /parent/classes — all classes the family's students are enrolled in.
   *
   * Returns class schedule info with day/time/instructor/room for weekly view.
   */
  fastify.get('/parent/classes', async (request, reply) => {
    const ctx = await requireParent(request, reply)
    if (!ctx) return

    // Get student IDs for this family
    const { data: students, error: studentsError } = await fastify.supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('family_id', ctx.familyId)
      .eq('organization_id', ctx.organizationId)
      .eq('active', true)

    if (studentsError) {
      return reply.code(500).send({ error: 'Failed to load students' })
    }

    const studentIds = (students ?? []).map((s: { id: string }) => s.id)
    if (studentIds.length === 0) {
      return reply.code(200).send({ classes: [] })
    }

    // Fetch enrollments with full class details
    const { data: enrollments, error: enrollError } = await fastify.supabase
      .from('enrollments')
      .select(`
        student_id,
        classes (
          id,
          name,
          type,
          day_of_week,
          start_time,
          duration_minutes,
          room,
          level,
          age_min,
          age_max,
          staff:instructor_id (first_name, last_name)
        )
      `)
      .in('student_id', studentIds)
      .eq('organization_id', ctx.organizationId)
      .eq('status', 'active')

    if (enrollError) {
      fastify.log.error({ error: enrollError }, 'Failed to load classes for parent')
      return reply.code(500).send({ error: 'Failed to load classes' })
    }

    // Build a map of class -> enrolled students to avoid duplicates
    const classMap = new Map<string, any>()
    for (const enrollment of (enrollments ?? [])) {
      const cls = (enrollment as any).classes
      if (!cls) continue
      const classId = cls.id as string

      if (!classMap.has(classId)) {
        classMap.set(classId, {
          ...cls,
          enrolled_students: [],
        })
      }

      const student = (students ?? []).find((s: any) => s.id === enrollment.student_id)
      if (student) {
        classMap.get(classId).enrolled_students.push({
          id: student.id,
          first_name: (student as any).first_name,
          last_name: (student as any).last_name,
        })
      }
    }

    return reply.code(200).send({
      classes: Array.from(classMap.values()),
    })
  })

  /**
   * GET /parent/attendance — attendance records for all family students.
   *
   * Supports optional filters:
   * - ?studentId=uuid — filter to a specific student
   * - ?startDate=YYYY-MM-DD — records on or after this date
   * - ?endDate=YYYY-MM-DD — records on or before this date
   */
  fastify.get<{ Querystring: ParentAttendanceQuery }>('/parent/attendance', async (request, reply) => {
    const ctx = await requireParent(request, reply)
    if (!ctx) return

    const { studentId, startDate, endDate } = request.query as ParentAttendanceQuery

    // Get student IDs for this family (or just the one if filtered)
    let studentIds: string[] = []

    if (studentId) {
      // Verify the student belongs to this family
      const { data: student, error: studentError } = await fastify.supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('family_id', ctx.familyId)
        .eq('organization_id', ctx.organizationId)
        .single()

      if (studentError || !student) {
        return reply.code(404).send({ error: 'Student not found in your family' })
      }
      studentIds = [student.id]
    } else {
      const { data: students, error: studentsError } = await fastify.supabase
        .from('students')
        .select('id')
        .eq('family_id', ctx.familyId)
        .eq('organization_id', ctx.organizationId)

      if (studentsError) {
        return reply.code(500).send({ error: 'Failed to load students' })
      }
      studentIds = (students ?? []).map((s: { id: string }) => s.id)
    }

    if (studentIds.length === 0) {
      return reply.code(200).send({ records: [] })
    }

    // Build attendance query with session + class join
    const query = fastify.supabase
      .from('attendance_records')
      .select(`
        id,
        student_id,
        status,
        created_at,
        students (first_name, last_name),
        class_sessions (
          session_date,
          classes (name, start_time)
        )
      `)
      .in('student_id', studentIds)
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    // Apply date filters via class_sessions.session_date
    // Since we can't filter nested joins directly with .gte/.lte on a joined
    // column in PostgREST, we fetch and filter in application code.
    const { data: records, error: recordsError } = await query

    if (recordsError) {
      fastify.log.error({ error: recordsError }, 'Failed to load attendance for parent')
      return reply.code(500).send({ error: 'Failed to load attendance records' })
    }

    // Apply date filtering in application layer
    let filtered = records ?? []
    if (startDate || endDate) {
      filtered = filtered.filter((r: any) => {
        const sessionDate = r.class_sessions?.session_date
        if (!sessionDate) return true
        if (startDate && sessionDate < startDate) return false
        if (endDate && sessionDate > endDate) return false
        return true
      })
    }

    return reply.code(200).send({ records: filtered })
  })

  /**
   * GET /parent/profile — returns the family's contact information.
   */
  fastify.get('/parent/profile', async (request, reply) => {
    const ctx = await requireParent(request, reply)
    if (!ctx) return

    const { data: family, error } = await fastify.supabase
      .from('families')
      .select(`
        id,
        primary_guardian_name,
        secondary_guardian_name,
        email,
        phone,
        emergency_contact_name,
        emergency_contact_phone,
        address
      `)
      .eq('id', ctx.familyId)
      .eq('organization_id', ctx.organizationId)
      .single()

    if (error || !family) {
      return reply.code(404).send({ error: 'Family not found' })
    }

    return reply.code(200).send(family)
  })

  /**
   * PATCH /parent/profile — update family contact information.
   *
   * Security: family_id comes from JWT, not from request params.
   * Parents can only update their own family's contact info.
   * Cannot modify students, enrollments, or billing.
   */
  fastify.patch<{ Body: UpdateParentProfileBody }>('/parent/profile', async (request, reply) => {
    const ctx = await requireParent(request, reply)
    if (!ctx) return

    const body = request.body as UpdateParentProfileBody
    if (!body || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' })
    }

    // Map camelCase body to snake_case DB columns
    const updateData: Record<string, unknown> = {}
    if (body.primaryGuardianName !== undefined) updateData.primary_guardian_name = body.primaryGuardianName
    if (body.secondaryGuardianName !== undefined) updateData.secondary_guardian_name = body.secondaryGuardianName
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.emergencyContactName !== undefined) updateData.emergency_contact_name = body.emergencyContactName
    if (body.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = body.emergencyContactPhone
    if (body.address !== undefined) updateData.address = body.address
    updateData.updated_at = new Date().toISOString()

    const { data: updated, error } = await fastify.supabase
      .from('families')
      .update(updateData)
      .eq('id', ctx.familyId)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single()

    if (error) {
      fastify.log.error({ error }, 'Failed to update parent profile')
      return reply.code(500).send({ error: 'Failed to update profile' })
    }

    return reply.code(200).send(updated)
  })
}

export default fp(parentRoutes, {
  name: 'parent-routes',
  dependencies: ['supabase', 'auth'],
})
