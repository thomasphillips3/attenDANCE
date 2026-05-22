import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type {
  CreateStudentBody,
  UpdateStudentBody,
  StudentListQuery,
} from '../types/index.js'

/**
 * Students CRUD routes (Plan 02-02)
 *
 * Every handler:
 * 1. Checks organizationId from JWT (401 if missing)
 * 2. Checks request.role === 'admin' (403 if not)
 * 3. Scopes all queries by organization_id
 *
 * CHILDREN'S DATA: GET /students list EXCLUDES medical_notes (T-02-10).
 * medical_notes only returned on GET /students/:id detail endpoint.
 *
 * Search input sanitized before PostgREST filter (T-02-11).
 */
const studentsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /students — paginated student list with search, active filter, and class filter.
   * Joins families for primary_guardian_name display.
   * EXCLUDES medical_notes from response (children's data protection).
   */
  fastify.get<{ Querystring: StudentListQuery }>(
    '/students',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const {
        search,
        classId,
        active,
        page = 1,
        limit = 50,
      } = request.query as StudentListQuery

      const safeLimit = Math.min(limit, 100)
      const from = (page - 1) * safeLimit

      // If classId filter is present, first get enrolled student IDs
      let enrolledStudentIds: string[] | undefined
      if (classId) {
        const { data: enrolled, error: enrollError } = await fastify.supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', classId)
          .eq('organization_id', organizationId)
          .eq('status', 'active')

        if (enrollError) {
          fastify.log.error({ error: enrollError }, 'Failed to query enrollments for class filter')
          return reply.code(500).send({ error: 'Failed to load students' })
        }

        enrolledStudentIds = (enrolled ?? []).map(
          (e: { student_id: string }) => e.student_id
        )

        // No enrolled students means empty result
        if (enrolledStudentIds.length === 0) {
          return reply.code(200).send({ data: [], total: 0, page, limit: safeLimit })
        }
      }

      // Build query — explicit column list EXCLUDES medical_notes (T-02-10)
      let query = fastify.supabase
        .from('students')
        .select(
          'id, organization_id, family_id, first_name, last_name, dob, photo_url, active, skill_level, created_at, updated_at, families(primary_guardian_name, email)',
          { count: 'exact' }
        )
        .eq('organization_id', organizationId)

      // Apply search filter with sanitized input (T-02-11)
      if (search) {
        const sanitized = search.replace(/[%_\\()"',]/g, '')
        if (sanitized.length > 0) {
          query = query.or(
            `first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%`
          )
        }
      }

      // Apply active filter
      if (active !== undefined) {
        query = query.eq('active', active)
      }

      // Apply class enrollment filter
      if (enrolledStudentIds) {
        query = query.in('id', enrolledStudentIds)
      }

      // Pagination and ordering
      query = query
        .order('last_name')
        .range(from, from + safeLimit - 1)

      const { data, count, error } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load students')
        return reply.code(500).send({ error: 'Failed to load students' })
      }

      return reply.code(200).send({
        data: data ?? [],
        total: count ?? 0,
        page,
        limit: safeLimit,
      })
    }
  )

  /**
   * GET /students/:id — student detail with family, signed photo URL, and RFID cards.
   * This endpoint INCLUDES medical_notes (admin detail view).
   */
  fastify.get<{ Params: { id: string } }>(
    '/students/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const { data: student, error } = await fastify.supabase
        .from('students')
        .select('*, families(id, primary_guardian_name, email, phone)')
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (error) {
        fastify.log.error({ error }, 'Failed to load student')
        return reply.code(500).send({ error: 'Failed to load student' })
      }

      if (!student) {
        return reply.code(404).send({ error: 'Student not found' })
      }

      // Generate signed URL for photo if stored as a storage path (T-02-08)
      let signedPhotoUrl: string | null = null
      if (student.photo_url) {
        const { data: signedData } = await fastify.supabase.storage
          .from('student-photos')
          .createSignedUrl(student.photo_url, 3600) // 1-hour expiry

        signedPhotoUrl = signedData?.signedUrl ?? null
      }

      // Fetch active RFID cards for this student
      const { data: rfidCards, error: rfidError } = await fastify.supabase
        .from('rfid_cards')
        .select('*')
        .eq('student_id', request.params.id)
        .eq('organization_id', organizationId)
        .eq('active', true)

      if (rfidError) {
        fastify.log.error({ error: rfidError }, 'Failed to load RFID cards')
        // Non-fatal — return student without RFID data
      }

      return reply.code(200).send({
        ...student,
        signedPhotoUrl,
        rfidCards: rfidCards ?? [],
      })
    }
  )

  /**
   * POST /students — create a new student.
   * Validates familyId belongs to the same organization (T-02-07).
   */
  fastify.post<{ Body: CreateStudentBody }>(
    '/students',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const body = request.body as CreateStudentBody

      // Verify familyId belongs to this organization (T-02-07)
      const { data: family, error: familyError } = await fastify.supabase
        .from('families')
        .select('id')
        .eq('id', body.familyId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (familyError) {
        fastify.log.error({ error: familyError }, 'Failed to verify family')
        return reply.code(500).send({ error: 'Failed to create student' })
      }

      if (!family) {
        return reply
          .code(400)
          .send({ error: 'Family not found in this organization' })
      }

      const { data: student, error } = await fastify.supabase
        .from('students')
        .insert({
          organization_id: organizationId,
          family_id: body.familyId,
          first_name: body.firstName,
          last_name: body.lastName,
          dob: body.dob ?? null,
          photo_url: body.photoUrl ?? null,
          medical_notes: body.medicalNotes ?? null,
          skill_level: body.skillLevel ?? null,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create student')
        return reply.code(500).send({ error: 'Failed to create student' })
      }

      return reply.code(201).send(student)
    }
  )

  /**
   * PATCH /students/:id — update an existing student.
   * Verifies org ownership before update.
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateStudentBody }>(
    '/students/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      const body = request.body as UpdateStudentBody

      // Verify student belongs to org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('students')
        .select('id')
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify student')
        return reply.code(500).send({ error: 'Failed to update student' })
      }

      if (!existing) {
        return reply.code(404).send({ error: 'Student not found' })
      }

      // Build update object from present fields only
      const changes: Record<string, unknown> = {}
      if (body.familyId !== undefined) changes.family_id = body.familyId
      if (body.firstName !== undefined) changes.first_name = body.firstName
      if (body.lastName !== undefined) changes.last_name = body.lastName
      if (body.dob !== undefined) changes.dob = body.dob
      if (body.photoUrl !== undefined) changes.photo_url = body.photoUrl
      if (body.medicalNotes !== undefined)
        changes.medical_notes = body.medicalNotes
      if (body.skillLevel !== undefined) changes.skill_level = body.skillLevel
      if (body.active !== undefined) changes.active = body.active
      changes.updated_at = new Date().toISOString()

      const { data: updated, error } = await fastify.supabase
        .from('students')
        .update(changes)
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update student')
        return reply.code(500).send({ error: 'Failed to update student' })
      }

      return reply.code(200).send(updated)
    }
  )
}

export default fp(studentsRoutes, {
  name: 'students',
  dependencies: ['supabase', 'auth'],
})
