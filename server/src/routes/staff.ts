import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Staff/Instructor routes -- instructor-scoped schedule, sessions, and hour logging.
 *
 * Prefix: /staff (shares the base with the GET /staff instructor picker in classes.ts,
 * but all routes here use distinct sub-paths: /staff/me/*, /staff/hours).
 *
 * Auth: instructor or admin role. Instructor endpoints filter to own data only.
 * Admin on /staff/me/* endpoints sees nothing (they have no staff record linked to
 * their auth user unless they are also an instructor).
 *
 * Organization scoping: all queries filter by request.organizationId from JWT.
 */

interface StaffHoursBody {
  date: string       // YYYY-MM-DD
  hours: number
  class_id?: string  // optional uuid
  notes?: string
}

interface HoursQuery {
  start_date?: string // YYYY-MM-DD
  end_date?: string   // YYYY-MM-DD
}

interface SessionsQuery {
  date?: string       // YYYY-MM-DD, defaults to today
}

const staffRoutes: FastifyPluginAsync = async (fastify) => {

  // Helper: resolve the staff record for the logged-in user
  async function getStaffForUser(userId: string, organizationId: string) {
    const { data, error } = await fastify.supabase
      .from('staff')
      .select('id, hourly_rate')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .maybeSingle()

    if (error) {
      fastify.log.error({ error }, 'Failed to look up staff record')
      return null
    }
    return data
  }

  // ---------------------------------------------------------------------------
  // GET /staff/me/schedule -- instructor's assigned classes with enrolled count
  // ---------------------------------------------------------------------------
  fastify.get('/staff/me/schedule', async (request, reply) => {
    const organizationId = request.organizationId
    const role = request.role

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (role !== 'instructor' && role !== 'admin') {
      return reply.code(403).send({ error: 'Instructor or admin role required' })
    }

    const userId = request.user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'Missing user identity' })
    }

    const staff = await getStaffForUser(userId, organizationId)
    if (!staff) {
      return reply.code(404).send({ error: 'No active staff record found for this user' })
    }

    // Get classes where this instructor is assigned (via classes.instructor_id)
    const { data: classes, error: classError } = await fastify.supabase
      .from('classes')
      .select('id, name, day_of_week, start_time, duration_minutes, room, capacity')
      .eq('organization_id', organizationId)
      .eq('instructor_id', staff.id)
      .eq('active', true)
      .order('day_of_week')
      .order('start_time')

    if (classError) {
      fastify.log.error({ error: classError }, 'Failed to load instructor schedule')
      return reply.code(500).send({ error: 'Failed to load schedule' })
    }

    const classIds = (classes ?? []).map((c: Record<string, unknown>) => c.id as string)

    // Fetch active enrollment counts per class
    let enrollmentCounts: Record<string, number> = {}
    if (classIds.length > 0) {
      const { data: enrollments, error: enrollError } = await fastify.supabase
        .from('enrollments')
        .select('class_id')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .in('class_id', classIds)

      if (enrollError) {
        fastify.log.error({ error: enrollError }, 'Failed to load enrollment counts')
        return reply.code(500).send({ error: 'Failed to load enrollment data' })
      }

      for (const e of enrollments ?? []) {
        const cid = e.class_id as string
        enrollmentCounts[cid] = (enrollmentCounts[cid] ?? 0) + 1
      }
    }

    const result = (classes ?? []).map((cls: Record<string, unknown>) => ({
      ...cls,
      enrolled_count: enrollmentCounts[cls.id as string] ?? 0,
    }))

    return reply.code(200).send({ data: result })
  })

  // ---------------------------------------------------------------------------
  // GET /staff/me/sessions?date=YYYY-MM-DD -- today's sessions for instructor
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: SessionsQuery }>('/staff/me/sessions', async (request, reply) => {
    const organizationId = request.organizationId
    const role = request.role

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (role !== 'instructor' && role !== 'admin') {
      return reply.code(403).send({ error: 'Instructor or admin role required' })
    }

    const userId = request.user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'Missing user identity' })
    }

    const staff = await getStaffForUser(userId, organizationId)
    if (!staff) {
      return reply.code(404).send({ error: 'No active staff record found for this user' })
    }

    const date = request.query.date ?? new Date().toISOString().slice(0, 10)

    // Get the instructor's class IDs
    const { data: classes, error: classError } = await fastify.supabase
      .from('classes')
      .select('id, name, start_time, duration_minutes, room')
      .eq('organization_id', organizationId)
      .eq('instructor_id', staff.id)
      .eq('active', true)

    if (classError) {
      fastify.log.error({ error: classError }, 'Failed to load instructor classes')
      return reply.code(500).send({ error: 'Failed to load classes' })
    }

    const classIds = (classes ?? []).map((c: Record<string, unknown>) => c.id as string)
    if (classIds.length === 0) {
      return reply.code(200).send({ data: [] })
    }

    // Build a class lookup map
    const classMap = new Map<string, Record<string, unknown>>()
    for (const cls of classes ?? []) {
      classMap.set(cls.id as string, cls)
    }

    // Fetch sessions for these classes on the given date
    const { data: sessions, error: sessionError } = await fastify.supabase
      .from('class_sessions')
      .select('id, class_id, session_date, status')
      .eq('organization_id', organizationId)
      .eq('session_date', date)
      .in('class_id', classIds)

    if (sessionError) {
      fastify.log.error({ error: sessionError }, 'Failed to load sessions')
      return reply.code(500).send({ error: 'Failed to load sessions' })
    }

    const sessionIds = (sessions ?? []).map((s: Record<string, unknown>) => s.id as string)

    // Fetch attendance records for these sessions
    let attendanceBySession: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {}
    if (sessionIds.length > 0) {
      const { data: records, error: attError } = await fastify.supabase
        .from('attendance_records')
        .select('class_session_id, status')
        .eq('organization_id', organizationId)
        .in('class_session_id', sessionIds)

      if (attError) {
        fastify.log.error({ error: attError }, 'Failed to load attendance')
      }

      for (const r of records ?? []) {
        const sid = r.class_session_id as string
        if (!attendanceBySession[sid]) {
          attendanceBySession[sid] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
        }
        attendanceBySession[sid].total++
        const status = r.status as string
        if (status === 'present') attendanceBySession[sid].present++
        else if (status === 'absent') attendanceBySession[sid].absent++
        else if (status === 'late') attendanceBySession[sid].late++
        else if (status === 'excused') attendanceBySession[sid].excused++
      }
    }

    // Fetch enrollment counts for the classes
    const { data: enrollments, error: enrollError } = await fastify.supabase
      .from('enrollments')
      .select('class_id')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .in('class_id', classIds)

    let enrolledCounts: Record<string, number> = {}
    if (!enrollError) {
      for (const e of enrollments ?? []) {
        const cid = e.class_id as string
        enrolledCounts[cid] = (enrolledCounts[cid] ?? 0) + 1
      }
    }

    const result = (sessions ?? []).map((session: Record<string, unknown>) => {
      const cls = classMap.get(session.class_id as string)
      const att = attendanceBySession[session.id as string] ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 }

      return {
        session_id: session.id,
        class_id: session.class_id,
        session_date: session.session_date,
        status: session.status,
        class_name: (cls?.name as string) ?? 'Unknown',
        start_time: (cls?.start_time as string) ?? '',
        duration_minutes: (cls?.duration_minutes as number) ?? 0,
        room: (cls?.room as string) ?? null,
        enrolled_count: enrolledCounts[session.class_id as string] ?? 0,
        attendance: att,
      }
    })

    return reply.code(200).send({ data: result })
  })

  // ---------------------------------------------------------------------------
  // POST /staff/hours -- log hours worked
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: StaffHoursBody }>('/staff/hours', async (request, reply) => {
    const organizationId = request.organizationId
    const role = request.role

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (role !== 'instructor' && role !== 'admin') {
      return reply.code(403).send({ error: 'Instructor or admin role required' })
    }

    const userId = request.user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'Missing user identity' })
    }

    const staff = await getStaffForUser(userId, organizationId)
    if (!staff) {
      return reply.code(404).send({ error: 'No active staff record found for this user' })
    }

    const { date, hours, class_id, notes } = request.body

    // Validate inputs
    if (!date || !hours) {
      return reply.code(400).send({ error: 'date and hours are required' })
    }
    if (hours <= 0 || hours > 24) {
      return reply.code(400).send({ error: 'hours must be between 0 and 24' })
    }

    // If class_id is provided, verify it belongs to this instructor's org
    if (class_id) {
      const { data: cls, error: clsError } = await fastify.supabase
        .from('classes')
        .select('id')
        .eq('id', class_id)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (clsError || !cls) {
        return reply.code(400).send({ error: 'Class not found in this organization' })
      }
    }

    const { data: inserted, error: insertError } = await fastify.supabase
      .from('staff_hours')
      .insert({
        organization_id: organizationId,
        staff_id: staff.id,
        class_id: class_id ?? null,
        date,
        hours,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (insertError) {
      fastify.log.error({ error: insertError }, 'Failed to log hours')
      return reply.code(500).send({ error: 'Failed to log hours' })
    }

    return reply.code(201).send(inserted)
  })

  // ---------------------------------------------------------------------------
  // GET /staff/me/hours?start_date=...&end_date=... -- instructor's hour log
  // ---------------------------------------------------------------------------
  fastify.get<{ Querystring: HoursQuery }>('/staff/me/hours', async (request, reply) => {
    const organizationId = request.organizationId
    const role = request.role

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }
    if (role !== 'instructor' && role !== 'admin') {
      return reply.code(403).send({ error: 'Instructor or admin role required' })
    }

    const userId = request.user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'Missing user identity' })
    }

    const staff = await getStaffForUser(userId, organizationId)
    if (!staff) {
      return reply.code(404).send({ error: 'No active staff record found for this user' })
    }

    // Build query with optional date range
    let query = fastify.supabase
      .from('staff_hours')
      .select('id, date, hours, notes, class_id, classes(name), created_at')
      .eq('organization_id', organizationId)
      .eq('staff_id', staff.id)
      .order('date', { ascending: false })

    if (request.query.start_date) {
      query = query.gte('date', request.query.start_date)
    }
    if (request.query.end_date) {
      query = query.lte('date', request.query.end_date)
    }

    const { data: hours, error: hoursError } = await query

    if (hoursError) {
      fastify.log.error({ error: hoursError }, 'Failed to load hours')
      return reply.code(500).send({ error: 'Failed to load hours' })
    }

    // Calculate totals
    const totalHours = (hours ?? []).reduce(
      (sum: number, h: Record<string, unknown>) => sum + Number(h.hours),
      0
    )
    const hourlyRate = Number(staff.hourly_rate) || 0
    const totalPay = Math.round(totalHours * hourlyRate * 100) / 100

    return reply.code(200).send({
      data: hours ?? [],
      total_hours: totalHours,
      hourly_rate: hourlyRate,
      total_pay: totalPay,
    })
  })
}

export default fp(staffRoutes, {
  name: 'staff-portal',
  dependencies: ['supabase', 'auth'],
})
