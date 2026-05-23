import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Events routes — event/recital CRUD, enrollment, and costume tracking (Plan 05-04).
 *
 * Every handler:
 * 1. Checks organizationId from JWT (401 if missing)
 * 2. Mutations require role === 'admin' (403 if not)
 * 3. Read endpoints allow admin, instructor, and front_desk
 * 4. All queries scoped by organization_id
 */
const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------------------
  // GET /events — list events with enrolled student counts
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { upcoming?: string; type?: string }
  }>('/events', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    const role = request.role
    if (role !== 'admin' && role !== 'instructor' && role !== 'front_desk') {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const { upcoming, type } = request.query as {
      upcoming?: string
      type?: string
    }

    try {
      let query = fastify.supabase
        .from('events')
        .select('*')
        .eq('organization_id', organizationId)

      // Filter by type if provided
      if (type) {
        query = query.eq('type', type)
      }

      // Filter by upcoming/past
      const today = new Date().toISOString().slice(0, 10)
      if (upcoming === 'false') {
        query = query.lt('event_date', today)
        query = query.order('event_date', { ascending: false })
      } else {
        // Default: upcoming (including today)
        query = query.gte('event_date', today)
        query = query.order('event_date', { ascending: true })
      }

      const { data: events, error } = await query

      if (error) {
        fastify.log.error({ error }, 'Failed to load events')
        return reply.code(500).send({ error: 'Failed to load events' })
      }

      const eventList = events ?? []

      // Get enrolled counts per event
      let enrolledCounts: Record<string, number> = {}
      if (eventList.length > 0) {
        const eventIds = eventList.map((e) => e.id)
        const { data: enrollments, error: enrollError } = await fastify.supabase
          .from('event_enrollments')
          .select('event_id')
          .eq('organization_id', organizationId)
          .in('event_id', eventIds)

        if (enrollError) {
          fastify.log.error({ error: enrollError }, 'Failed to load event enrollment counts')
        } else {
          for (const enrollment of enrollments ?? []) {
            enrolledCounts[enrollment.event_id] =
              (enrolledCounts[enrollment.event_id] ?? 0) + 1
          }
        }
      }

      const data = eventList.map((event) => ({
        ...event,
        enrolledCount: enrolledCounts[event.id] ?? 0,
      }))

      return reply.code(200).send({ data })
    } catch (err) {
      fastify.log.error({ error: err }, 'Events list error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ---------------------------------------------------------------------------
  // GET /events/:id — event detail with enrolled students and costume status
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/events/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const role = request.role
      if (role !== 'admin' && role !== 'instructor' && role !== 'front_desk') {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      try {
        // Get event
        const { data: event, error } = await fastify.supabase
          .from('events')
          .select('*')
          .eq('id', request.params.id)
          .eq('organization_id', organizationId)
          .maybeSingle()

        if (error) {
          fastify.log.error({ error }, 'Failed to load event')
          return reply.code(500).send({ error: 'Failed to load event' })
        }

        if (!event) {
          return reply.code(404).send({ error: 'Event not found' })
        }

        // Get enrolled students with names
        const { data: enrollments, error: enrollError } = await fastify.supabase
          .from('event_enrollments')
          .select(
            'id, student_id, enrolled_at, students(id, first_name, last_name)'
          )
          .eq('event_id', event.id)
          .eq('organization_id', organizationId)

        if (enrollError) {
          fastify.log.error({ error: enrollError }, 'Failed to load event enrollments')
          return reply.code(500).send({ error: 'Failed to load event details' })
        }

        // Get costumes for this event with student names
        const { data: costumes, error: costumeError } = await fastify.supabase
          .from('costumes')
          .select(
            'id, student_id, description, size, ordered, received, paid, created_at, updated_at, students(id, first_name, last_name)'
          )
          .eq('event_id', event.id)
          .eq('organization_id', organizationId)

        if (costumeError) {
          fastify.log.error({ error: costumeError }, 'Failed to load costumes')
          return reply.code(500).send({ error: 'Failed to load event details' })
        }

        return reply.code(200).send({
          ...event,
          enrollments: enrollments ?? [],
          costumes: costumes ?? [],
          enrolledCount: (enrollments ?? []).length,
        })
      } catch (err) {
        fastify.log.error({ error: err }, 'Event detail error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )

  // ---------------------------------------------------------------------------
  // POST /events — create event (admin only)
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      name: string
      event_date: string
      venue?: string
      type: string
    }
  }>('/events', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const body = request.body as {
      name: string
      event_date: string
      venue?: string
      type: string
    }

    if (!body.name || !body.event_date || !body.type) {
      return reply
        .code(400)
        .send({ error: 'name, event_date, and type are required' })
    }

    const validTypes = ['recital', 'showcase', 'workshop', 'camp']
    if (!validTypes.includes(body.type)) {
      return reply
        .code(400)
        .send({ error: `type must be one of: ${validTypes.join(', ')}` })
    }

    try {
      const { data: event, error } = await fastify.supabase
        .from('events')
        .insert({
          organization_id: organizationId,
          name: body.name,
          event_date: body.event_date,
          venue: body.venue ?? null,
          type: body.type,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create event')
        return reply.code(500).send({ error: 'Failed to create event' })
      }

      return reply.code(201).send(event)
    } catch (err) {
      fastify.log.error({ error: err }, 'Create event error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ---------------------------------------------------------------------------
  // PUT /events/:id — update event (admin only)
  // ---------------------------------------------------------------------------
  fastify.put<{
    Params: { id: string }
    Body: {
      name?: string
      event_date?: string
      venue?: string
      type?: string
    }
  }>('/events/:id', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const body = request.body as {
      name?: string
      event_date?: string
      venue?: string
      type?: string
    }

    // Validate type if provided
    if (body.type) {
      const validTypes = ['recital', 'showcase', 'workshop', 'camp']
      if (!validTypes.includes(body.type)) {
        return reply
          .code(400)
          .send({ error: `type must be one of: ${validTypes.join(', ')}` })
      }
    }

    try {
      // Verify event exists and belongs to org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('events')
        .select('id')
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify event')
        return reply.code(500).send({ error: 'Failed to update event' })
      }

      if (!existing) {
        return reply.code(404).send({ error: 'Event not found' })
      }

      const changes: Record<string, unknown> = {}
      if (body.name !== undefined) changes.name = body.name
      if (body.event_date !== undefined) changes.event_date = body.event_date
      if (body.venue !== undefined) changes.venue = body.venue
      if (body.type !== undefined) changes.type = body.type
      changes.updated_at = new Date().toISOString()

      const { data: updated, error } = await fastify.supabase
        .from('events')
        .update(changes)
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update event')
        return reply.code(500).send({ error: 'Failed to update event' })
      }

      return reply.code(200).send(updated)
    } catch (err) {
      fastify.log.error({ error: err }, 'Update event error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ---------------------------------------------------------------------------
  // DELETE /events/:id — delete event (admin only)
  // Cascades to event_enrollments and costumes via ON DELETE CASCADE
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/events/:id',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      try {
        const { error } = await fastify.supabase
          .from('events')
          .delete()
          .eq('id', request.params.id)
          .eq('organization_id', organizationId)

        if (error) {
          fastify.log.error({ error }, 'Failed to delete event')
          return reply.code(500).send({ error: 'Failed to delete event' })
        }

        return reply.code(204).send()
      } catch (err) {
        fastify.log.error({ error: err }, 'Delete event error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )

  // ---------------------------------------------------------------------------
  // POST /events/:id/enroll — bulk enroll students (admin only)
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string }
    Body: { student_ids: string[] }
  }>('/events/:id/enroll', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const { student_ids } = request.body as { student_ids: string[] }

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return reply.code(400).send({ error: 'student_ids array is required' })
    }

    try {
      // Verify event exists and belongs to org
      const { data: event, error: eventError } = await fastify.supabase
        .from('events')
        .select('id')
        .eq('id', request.params.id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (eventError) {
        fastify.log.error({ error: eventError }, 'Failed to verify event')
        return reply.code(500).send({ error: 'Failed to enroll students' })
      }

      if (!event) {
        return reply.code(404).send({ error: 'Event not found' })
      }

      // Build enrollment rows
      const rows = student_ids.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_id: request.params.id,
      }))

      // Use upsert with ignoreDuplicates for ON CONFLICT DO NOTHING behavior
      const { data: enrolled, error } = await fastify.supabase
        .from('event_enrollments')
        .upsert(rows, { onConflict: 'student_id,event_id', ignoreDuplicates: true })
        .select()

      if (error) {
        fastify.log.error({ error }, 'Failed to enroll students')
        return reply.code(500).send({ error: 'Failed to enroll students' })
      }

      return reply.code(201).send({ enrolled: enrolled ?? [] })
    } catch (err) {
      fastify.log.error({ error: err }, 'Enroll students error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ---------------------------------------------------------------------------
  // DELETE /events/:id/enroll/:studentId — remove student from event (admin only)
  // ---------------------------------------------------------------------------
  fastify.delete<{ Params: { id: string; studentId: string } }>(
    '/events/:id/enroll/:studentId',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }
      if (request.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin role required' })
      }

      try {
        // Delete enrollment
        const { error } = await fastify.supabase
          .from('event_enrollments')
          .delete()
          .eq('event_id', request.params.id)
          .eq('student_id', request.params.studentId)
          .eq('organization_id', organizationId)

        if (error) {
          fastify.log.error({ error }, 'Failed to remove student from event')
          return reply
            .code(500)
            .send({ error: 'Failed to remove student from event' })
        }

        // Also remove any costume entry for this student in this event
        await fastify.supabase
          .from('costumes')
          .delete()
          .eq('event_id', request.params.id)
          .eq('student_id', request.params.studentId)
          .eq('organization_id', organizationId)

        return reply.code(204).send()
      } catch (err) {
        fastify.log.error({ error: err }, 'Remove enrollment error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )

  // ---------------------------------------------------------------------------
  // GET /events/:id/costumes — list costumes for event with student names
  // ---------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/events/:id/costumes',
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) {
        return reply.code(401).send({ error: 'Missing organization context' })
      }

      const role = request.role
      if (role !== 'admin' && role !== 'instructor' && role !== 'front_desk') {
        return reply.code(403).send({ error: 'Forbidden' })
      }

      try {
        const { data: costumes, error } = await fastify.supabase
          .from('costumes')
          .select(
            'id, student_id, description, size, ordered, received, paid, created_at, updated_at, students(id, first_name, last_name)'
          )
          .eq('event_id', request.params.id)
          .eq('organization_id', organizationId)

        if (error) {
          fastify.log.error({ error }, 'Failed to load costumes')
          return reply.code(500).send({ error: 'Failed to load costumes' })
        }

        return reply.code(200).send({ data: costumes ?? [] })
      } catch (err) {
        fastify.log.error({ error: err }, 'Costumes list error')
        return reply.code(500).send({ error: 'Internal server error' })
      }
    }
  )

  // ---------------------------------------------------------------------------
  // POST /events/:id/costumes — create costume entry (admin only)
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string }
    Body: { student_id: string; description?: string; size?: string }
  }>('/events/:id/costumes', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const body = request.body as {
      student_id: string
      description?: string
      size?: string
    }

    if (!body.student_id) {
      return reply.code(400).send({ error: 'student_id is required' })
    }

    try {
      const { data: costume, error } = await fastify.supabase
        .from('costumes')
        .insert({
          organization_id: organizationId,
          student_id: body.student_id,
          event_id: request.params.id,
          description: body.description ?? null,
          size: body.size ?? null,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create costume')
        return reply.code(500).send({ error: 'Failed to create costume' })
      }

      return reply.code(201).send(costume)
    } catch (err) {
      fastify.log.error({ error: err }, 'Create costume error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ---------------------------------------------------------------------------
  // PUT /costumes/:costumeId — update costume status (admin only)
  // ---------------------------------------------------------------------------
  fastify.put<{
    Params: { costumeId: string }
    Body: {
      ordered?: boolean
      received?: boolean
      paid?: boolean
      description?: string
      size?: string
    }
  }>('/costumes/:costumeId', async (request, reply) => {
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (request.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required' })
    }

    const body = request.body as {
      ordered?: boolean
      received?: boolean
      paid?: boolean
      description?: string
      size?: string
    }

    try {
      // Verify costume exists and belongs to org
      const { data: existing, error: checkError } = await fastify.supabase
        .from('costumes')
        .select('id')
        .eq('id', request.params.costumeId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (checkError) {
        fastify.log.error({ error: checkError }, 'Failed to verify costume')
        return reply.code(500).send({ error: 'Failed to update costume' })
      }

      if (!existing) {
        return reply.code(404).send({ error: 'Costume not found' })
      }

      const changes: Record<string, unknown> = {}
      if (body.ordered !== undefined) changes.ordered = body.ordered
      if (body.received !== undefined) changes.received = body.received
      if (body.paid !== undefined) changes.paid = body.paid
      if (body.description !== undefined) changes.description = body.description
      if (body.size !== undefined) changes.size = body.size
      changes.updated_at = new Date().toISOString()

      const { data: updated, error } = await fastify.supabase
        .from('costumes')
        .update(changes)
        .eq('id', request.params.costumeId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to update costume')
        return reply.code(500).send({ error: 'Failed to update costume' })
      }

      return reply.code(200).send(updated)
    } catch (err) {
      fastify.log.error({ error: err }, 'Update costume error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}

export default fp(eventsRoutes, {
  name: 'events',
  dependencies: ['supabase', 'auth'],
})
