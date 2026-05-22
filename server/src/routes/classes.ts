import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { CreateClassBody, UpdateClassBody } from '../types/index.js'

/**
 * Classes routes — CRUD for class management and staff list for instructor picker.
 *
 * Every handler enforces:
 * - Admin role gate (T-02-10): request.role !== 'admin' -> 403
 * - Organization scope (T-02-11): organization_id from JWT on every query
 * - Instructor org membership (T-02-12): verify staff belongs to same org before assign
 */
const classesRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------------------
  // GET /classes — list all classes with instructor names and enrollment counts
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: { active?: string } }>('/classes', async (request, reply) => {
    const organizationId = request.organizationId

    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // Build classes query with staff join
    let query = fastify.supabase
      .from('classes')
      .select('*, staff:instructor_id(id, first_name, last_name)')
      .eq('organization_id', organizationId)

    // Filter by active status — default to active=true if not specified
    const activeParam = request.query.active
    if (activeParam !== undefined) {
      const isActive = activeParam === 'true'
      query = query.eq('active', isActive)
    } else {
      query = query.eq('active', true)
    }

    query = query.order('day_of_week').order('start_time')

    const { data: classes, error: classError } = await query

    if (classError) {
      fastify.log.error({ error: classError }, 'Failed to load classes')
      return reply.code(500).send({ error: 'Failed to load classes' })
    }

    // Fetch active enrollment counts per class
    const { data: enrollments, error: enrollError } = await fastify.supabase
      .from('enrollments')
      .select('class_id')
      .eq('organization_id', organizationId)
      .eq('status', 'active')

    if (enrollError) {
      fastify.log.error({ error: enrollError }, 'Failed to load enrollment counts')
      return reply.code(500).send({ error: 'Failed to load enrollment counts' })
    }

    // Group enrollment counts by class_id
    const countMap = new Map<string, number>()
    for (const e of enrollments ?? []) {
      const cid = e.class_id as string
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1)
    }

    // Merge enrollment counts into class results
    const classesWithCounts = (classes ?? []).map((cls: Record<string, unknown>) => ({
      ...cls,
      enrolledCount: countMap.get(cls.id as string) ?? 0,
    }))

    return reply.code(200).send({ data: classesWithCounts })
  })

  // ---------------------------------------------------------------------------
  // GET /classes/:id — class detail with enrollment breakdown
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>('/classes/:id', async (request, reply) => {
    const organizationId = request.organizationId
    const classId = request.params.id

    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const { data: classData, error: classError } = await fastify.supabase
      .from('classes')
      .select('*, staff:instructor_id(id, first_name, last_name)')
      .eq('id', classId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (classError) {
      fastify.log.error({ error: classError }, 'Failed to load class')
      return reply.code(500).send({ error: 'Failed to load class' })
    }
    if (!classData) {
      return reply.code(404).send({ error: 'Class not found' })
    }

    // Fetch enrollments with student details
    const { data: enrollments, error: enrollError } = await fastify.supabase
      .from('enrollments')
      .select('id, status, student_id, students(id, first_name, last_name, active, photo_url)')
      .eq('class_id', classId)
      .eq('organization_id', organizationId)
      .order('enrolled_at')

    if (enrollError) {
      fastify.log.error({ error: enrollError }, 'Failed to load enrollments for class')
      return reply.code(500).send({ error: 'Failed to load enrollments' })
    }

    const allEnrollments = enrollments ?? []
    const activeEnrollments = allEnrollments.filter(
      (e: Record<string, unknown>) => e.status === 'active'
    )
    const waitlistEnrollments = allEnrollments.filter(
      (e: Record<string, unknown>) => e.status === 'waitlist'
    )

    return reply.code(200).send({
      ...classData,
      activeEnrollments,
      waitlistEnrollments,
      enrolledCount: activeEnrollments.length,
      waitlistCount: waitlistEnrollments.length,
    })
  })

  // ---------------------------------------------------------------------------
  // POST /classes — create a new class
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: CreateClassBody }>('/classes', async (request, reply) => {
    const organizationId = request.organizationId
    const body = request.body

    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // T-02-12: Verify instructor belongs to same org before assigning
    if (body.instructorId) {
      const { data: staffMember, error: staffError } = await fastify.supabase
        .from('staff')
        .select('id')
        .eq('id', body.instructorId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (staffError) {
        fastify.log.error({ error: staffError }, 'Failed to verify instructor')
        return reply.code(500).send({ error: 'Failed to verify instructor' })
      }
      if (!staffMember) {
        return reply.code(400).send({ error: 'Instructor not found in this organization' })
      }
    }

    // Validate age range
    if (
      body.ageMin !== undefined && body.ageMin !== null &&
      body.ageMax !== undefined && body.ageMax !== null &&
      body.ageMax < body.ageMin
    ) {
      return reply.code(400).send({ error: 'Maximum age must be >= minimum age' })
    }

    const { data: newClass, error: insertError } = await fastify.supabase
      .from('classes')
      .insert({
        organization_id: organizationId,
        name: body.name,
        type: body.type ?? 'recurring',
        instructor_id: body.instructorId ?? null,
        day_of_week: body.dayOfWeek ?? null,
        start_time: body.startTime,
        duration_minutes: body.durationMinutes,
        room: body.room ?? null,
        capacity: body.capacity ?? null,
        age_min: body.ageMin ?? null,
        age_max: body.ageMax ?? null,
        level: body.level ?? null,
      })
      .select()
      .single()

    if (insertError) {
      fastify.log.error({ error: insertError }, 'Failed to create class')
      return reply.code(500).send({ error: 'Failed to create class' })
    }

    return reply.code(201).send(newClass)
  })

  // ---------------------------------------------------------------------------
  // PATCH /classes/:id — update an existing class
  // ---------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string }; Body: UpdateClassBody }>(
    '/classes/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      const classId = request.params.id
      const body = request.body

      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      // Verify class belongs to this org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('classes')
        .select('id')
        .eq('id', classId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify class ownership')
        return reply.code(500).send({ error: 'Failed to verify class' })
      }
      if (!existing) {
        return reply.code(404).send({ error: 'Class not found' })
      }

      // T-02-12: If updating instructor, verify staff belongs to same org
      if (body.instructorId) {
        const { data: staffMember, error: staffError } = await fastify.supabase
          .from('staff')
          .select('id')
          .eq('id', body.instructorId)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (staffError) {
          fastify.log.error({ error: staffError }, 'Failed to verify instructor')
          return reply.code(500).send({ error: 'Failed to verify instructor' })
        }
        if (!staffMember) {
          return reply.code(400).send({ error: 'Instructor not found in this organization' })
        }
      }

      // Build update object from present body fields with snake_case mapping
      const changes: Record<string, unknown> = {}
      if (body.name !== undefined) changes.name = body.name
      if (body.type !== undefined) changes.type = body.type
      if (body.instructorId !== undefined) changes.instructor_id = body.instructorId
      if (body.dayOfWeek !== undefined) changes.day_of_week = body.dayOfWeek
      if (body.startTime !== undefined) changes.start_time = body.startTime
      if (body.durationMinutes !== undefined) changes.duration_minutes = body.durationMinutes
      if (body.room !== undefined) changes.room = body.room
      if (body.capacity !== undefined) changes.capacity = body.capacity
      if (body.ageMin !== undefined) changes.age_min = body.ageMin
      if (body.ageMax !== undefined) changes.age_max = body.ageMax
      if (body.level !== undefined) changes.level = body.level
      if (body.active !== undefined) changes.active = body.active

      if (Object.keys(changes).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' })
      }

      const { data: updated, error: updateError } = await fastify.supabase
        .from('classes')
        .update(changes)
        .eq('id', classId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (updateError) {
        fastify.log.error({ error: updateError }, 'Failed to update class')
        return reply.code(500).send({ error: 'Failed to update class' })
      }

      return reply.code(200).send(updated)
    }
  )

  // ---------------------------------------------------------------------------
  // GET /staff — active staff list for instructor picker
  // ---------------------------------------------------------------------------
  fastify.get('/staff', async (request, reply) => {
    const organizationId = request.organizationId

    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const { data, error } = await fastify.supabase
      .from('staff')
      .select('id, first_name, last_name, role')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('last_name')

    if (error) {
      fastify.log.error({ error }, 'Failed to load staff')
      return reply.code(500).send({ error: 'Failed to load staff' })
    }

    return reply.code(200).send(data ?? [])
  })
}

export default fp(classesRoutes, {
  name: 'classes',
  dependencies: ['supabase', 'auth'],
})
