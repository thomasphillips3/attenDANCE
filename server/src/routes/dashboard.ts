import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Dashboard routes — admin KPI cards and today's class summaries.
 *
 * GET /dashboard/today
 * Returns aggregate KPIs for the current day and per-class summary cards
 * for the authenticated organization. Role-gated to admin and front_desk.
 *
 * organizationId sourced exclusively from request.organizationId (JWT).
 */
const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard/today', async (request, reply) => {
    const organizationId = request.organizationId
    const role = request.role

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // Role gate: only admin and front_desk can view the dashboard
    if (role !== 'admin' && role !== 'front_desk') {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    try {
      // 1. Get today's class sessions joined with class and instructor info
      const { data: sessions, error: sessionsError } = await fastify.supabase
        .from('class_sessions')
        .select(`
          id,
          status,
          class_id,
          classes (
            id,
            name,
            start_time,
            instructor_id,
            staff:instructor_id (
              first_name,
              last_name
            )
          )
        `)
        .eq('organization_id', organizationId)
        .eq('session_date', today)

      if (sessionsError) {
        fastify.log.error({ error: sessionsError }, 'Failed to load dashboard sessions')
        return reply.code(500).send({ error: 'Failed to load dashboard data' })
      }

      const todaySessions = sessions ?? []

      // 2. Get all attendance records for today's sessions
      const sessionIds = todaySessions.map((s) => s.id)

      let attendanceRecords: Array<{
        id: string
        student_id: string
        class_session_id: string
        status: string
        marked_by: string
        marked_by_staff_id: string | null
      }> = []

      if (sessionIds.length > 0) {
        const { data: records, error: attendanceError } = await fastify.supabase
          .from('attendance_records')
          .select('id, student_id, class_session_id, status, marked_by, marked_by_staff_id')
          .eq('organization_id', organizationId)
          .in('class_session_id', sessionIds)

        if (attendanceError) {
          fastify.log.error({ error: attendanceError }, 'Failed to load attendance records')
          return reply.code(500).send({ error: 'Failed to load dashboard data' })
        }

        attendanceRecords = records ?? []
      }

      // 3. Get enrollment counts for today's classes
      const classIds = [...new Set(todaySessions.map((s) => s.class_id).filter(Boolean))]
      let enrollmentCounts: Record<string, number> = {}

      if (classIds.length > 0) {
        const { data: enrollments, error: enrollError } = await fastify.supabase
          .from('enrollments')
          .select('class_id, student_id')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .in('class_id', classIds)

        if (enrollError) {
          fastify.log.error({ error: enrollError }, 'Failed to load enrollment counts')
          return reply.code(500).send({ error: 'Failed to load dashboard data' })
        }

        // Count distinct students per class
        for (const e of enrollments ?? []) {
          enrollmentCounts[e.class_id] = (enrollmentCounts[e.class_id] ?? 0) + 1
        }
      }

      // 4. RFID check-ins in the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()

      const { data: rfidRecords, error: rfidError } = await fastify.supabase
        .from('attendance_records')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('marked_by', 'rfid')
        .gte('created_at', sevenDaysAgoStr)

      if (rfidError) {
        fastify.log.error({ error: rfidError }, 'Failed to count RFID check-ins')
        // Non-fatal: continue with 0
      }

      // 5. Look up staff names for marked_by_staff_id
      const staffIds = [
        ...new Set(
          attendanceRecords
            .map((r) => r.marked_by_staff_id)
            .filter((id): id is string => id !== null)
        ),
      ]

      let staffNames: Record<string, string> = {}
      if (staffIds.length > 0) {
        const { data: staffRows } = await fastify.supabase
          .from('staff')
          .select('id, first_name, last_name')
          .in('id', staffIds)

        for (const s of staffRows ?? []) {
          staffNames[s.id] = `${s.first_name} ${s.last_name}`
        }
      }

      // 6. Compute KPIs
      const classesToday = todaySessions.length

      const checkedInStudents = new Set(
        attendanceRecords
          .filter((r) => r.status === 'present' || r.status === 'late')
          .map((r) => r.student_id)
      )
      const studentsCheckedIn = checkedInStudents.size

      // Total enrolled today = sum of enrollment counts across today's classes
      const allEnrolledToday = Object.values(enrollmentCounts).reduce((sum, c) => sum + c, 0)

      const absencesToday = attendanceRecords.filter((r) => r.status === 'absent').length
      const excusedToday = attendanceRecords.filter((r) => r.status === 'excused').length

      const rfidCheckinsWeek = rfidRecords?.length ?? 0

      // 7. Build class summaries
      const classSummaries = todaySessions.map((session) => {
        const classData = session.classes as unknown as {
          id: string
          name: string
          start_time: string
          instructor_id: string
          staff: { first_name: string; last_name: string } | null
        }

        const sessionAttendance = attendanceRecords.filter(
          (r) => r.class_session_id === session.id
        )

        const presentCount = sessionAttendance.filter(
          (r) => r.status === 'present' || r.status === 'late'
        ).length
        const absentCount = sessionAttendance.filter((r) => r.status === 'absent').length
        const totalEnrolled = enrollmentCounts[session.class_id] ?? 0

        // Determine who marked attendance (most recent marker)
        const lastRecord = sessionAttendance[sessionAttendance.length - 1]
        let markedByLabel = '-'
        if (lastRecord) {
          if (lastRecord.marked_by === 'rfid') {
            markedByLabel = 'RFID'
          } else if (lastRecord.marked_by_staff_id && staffNames[lastRecord.marked_by_staff_id]) {
            markedByLabel = staffNames[lastRecord.marked_by_staff_id]
          } else {
            markedByLabel = 'Staff'
          }
        }

        // Format time from 24h "HH:MM:SS" to "H:MM AM/PM"
        let formattedTime = classData?.start_time ?? ''
        if (formattedTime) {
          const [h, m] = formattedTime.split(':').map(Number)
          const ampm = h >= 12 ? 'PM' : 'AM'
          const hour12 = h % 12 || 12
          formattedTime = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
        }

        const instructorName = classData?.staff
          ? `${classData.staff.first_name} ${classData.staff.last_name}`
          : undefined

        return {
          sessionId: session.id,
          classId: session.class_id,
          className: classData?.name ?? 'Unknown',
          time: formattedTime,
          instructorName,
          presentCount,
          absentCount,
          totalEnrolled,
          status: session.status as string,
          markedBy: markedByLabel,
        }
      })

      // Sort by start_time
      classSummaries.sort((a, b) => {
        const timeA = a.time ?? ''
        const timeB = b.time ?? ''
        return timeA.localeCompare(timeB)
      })

      return reply.code(200).send({
        classesToday,
        studentsCheckedIn,
        totalEnrolledToday: allEnrolledToday,
        absencesToday,
        excusedToday,
        rfidCheckinsWeek,
        classSummaries,
      })
    } catch (err) {
      fastify.log.error({ error: err }, 'Dashboard endpoint error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}

export default fp(dashboardRoutes, {
  name: 'dashboard',
  dependencies: ['supabase', 'auth'],
})
