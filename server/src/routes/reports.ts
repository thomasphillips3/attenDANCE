import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Report routes -- admin-only aggregated reports with CSV-ready rows.
 *
 * GET /reports/enrollment?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * GET /reports/revenue?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * GET /reports/attendance?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * All endpoints require admin role and organization context from JWT.
 */
const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Shared admin gate ──────────────────────────────────────────────
  function assertAdmin(request: { organizationId?: string; role?: string }, reply: any) {
    if (!request.organizationId) {
      reply.code(401).send({ error: 'Missing organization context' })
      return false
    }
    if (request.role !== 'admin') {
      reply.code(403).send({ error: 'Forbidden' })
      return false
    }
    return true
  }

  // ── GET /reports/enrollment ────────────────────────────────────────
  fastify.get('/reports/enrollment', async (request, reply) => {
    if (!assertAdmin(request, reply)) return

    const organizationId = request.organizationId!
    const { start_date, end_date } = request.query as {
      start_date?: string
      end_date?: string
    }

    if (!start_date || !end_date) {
      return reply.code(400).send({ error: 'start_date and end_date query params required' })
    }

    try {
      // Get all enrollments for the org
      const { data: enrollments, error: enrollError } = await fastify.supabase
        .from('enrollments')
        .select('id, class_id, student_id, status, enrolled_at, dropped_at')
        .eq('organization_id', organizationId)

      if (enrollError) {
        fastify.log.error({ error: enrollError }, 'Failed to load enrollments for report')
        return reply.code(500).send({ error: 'Failed to load enrollment data' })
      }

      // Get classes for names
      const { data: classes, error: classesError } = await fastify.supabase
        .from('classes')
        .select('id, name')
        .eq('organization_id', organizationId)

      if (classesError) {
        fastify.log.error({ error: classesError }, 'Failed to load classes for report')
        return reply.code(500).send({ error: 'Failed to load class data' })
      }

      const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]))
      const allEnrollments = enrollments ?? []

      // Per-class breakdown
      const perClass: Record<string, { active: number; waitlist: number; dropped: number }> = {}
      for (const cls of classes ?? []) {
        perClass[cls.id] = { active: 0, waitlist: 0, dropped: 0 }
      }

      let totalActive = 0
      let newEnrollments = 0
      let drops = 0

      for (const e of allEnrollments) {
        if (!perClass[e.class_id]) {
          perClass[e.class_id] = { active: 0, waitlist: 0, dropped: 0 }
        }

        if (e.status === 'active') {
          perClass[e.class_id].active++
          totalActive++
        } else if (e.status === 'waitlist') {
          perClass[e.class_id].waitlist++
        } else if (e.status === 'dropped') {
          perClass[e.class_id].dropped++
        }

        // New enrollments in the date range
        if (e.enrolled_at && e.enrolled_at >= start_date && e.enrolled_at <= end_date + 'T23:59:59') {
          newEnrollments++
        }

        // Drops in the date range
        if (
          e.status === 'dropped' &&
          e.dropped_at &&
          e.dropped_at >= start_date &&
          e.dropped_at <= end_date + 'T23:59:59'
        ) {
          drops++
        }
      }

      // Build rows for CSV
      const rows = Object.entries(perClass).map(([classId, counts]) => ({
        class_name: classMap.get(classId) ?? 'Unknown',
        active: counts.active,
        waitlist: counts.waitlist,
        dropped: counts.dropped,
      }))

      // Sort alphabetically by class name
      rows.sort((a, b) => a.class_name.localeCompare(b.class_name))

      return reply.code(200).send({
        summary: {
          total_active: totalActive,
          new_enrollments: newEnrollments,
          drops,
        },
        rows,
      })
    } catch (err) {
      fastify.log.error({ error: err }, 'Enrollment report error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── GET /reports/revenue ───────────────────────────────────────────
  fastify.get('/reports/revenue', async (request, reply) => {
    if (!assertAdmin(request, reply)) return

    const organizationId = request.organizationId!
    const { start_date, end_date } = request.query as {
      start_date?: string
      end_date?: string
    }

    if (!start_date || !end_date) {
      return reply.code(400).send({ error: 'start_date and end_date query params required' })
    }

    try {
      // Get payments in the date range
      const { data: payments, error: payError } = await fastify.supabase
        .from('payments')
        .select('id, amount, method, paid_at')
        .eq('organization_id', organizationId)
        .gte('paid_at', start_date)
        .lte('paid_at', end_date + 'T23:59:59')

      if (payError) {
        fastify.log.error({ error: payError }, 'Failed to load payments for report')
        return reply.code(500).send({ error: 'Failed to load payment data' })
      }

      // Get invoices for outstanding/overdue
      const { data: invoices, error: invError } = await fastify.supabase
        .from('invoices')
        .select('id, amount, status, due_date')
        .eq('organization_id', organizationId)

      if (invError) {
        fastify.log.error({ error: invError }, 'Failed to load invoices for report')
        return reply.code(500).send({ error: 'Failed to load invoice data' })
      }

      const allPayments = payments ?? []
      const allInvoices = invoices ?? []

      // Total collected in period
      let totalCollected = 0
      let stripeTotal = 0
      let cashTotal = 0
      let checkTotal = 0

      for (const p of allPayments) {
        const amt = Number(p.amount) || 0
        totalCollected += amt
        if (p.method === 'stripe') stripeTotal += amt
        else if (p.method === 'cash') cashTotal += amt
        else if (p.method === 'check') checkTotal += amt
      }

      // Outstanding and overdue invoices
      let outstanding = 0
      let overdue = 0
      for (const inv of allInvoices) {
        const amt = Number(inv.amount) || 0
        if (inv.status === 'pending') outstanding += amt
        if (inv.status === 'overdue') overdue += amt
      }

      // Monthly trend: group payments by month
      const monthlyMap = new Map<string, { collected: number; invoiced: number }>()

      for (const p of allPayments) {
        const month = (p.paid_at as string).slice(0, 7) // YYYY-MM
        const entry = monthlyMap.get(month) ?? { collected: 0, invoiced: 0 }
        entry.collected += Number(p.amount) || 0
        monthlyMap.set(month, entry)
      }

      // Also add invoiced amounts by due_date month
      for (const inv of allInvoices) {
        if (inv.due_date >= start_date && inv.due_date <= end_date) {
          const month = inv.due_date.slice(0, 7)
          const entry = monthlyMap.get(month) ?? { collected: 0, invoiced: 0 }
          entry.invoiced += Number(inv.amount) || 0
          monthlyMap.set(month, entry)
        }
      }

      const monthly_trend = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month))

      // Rows for CSV: monthly breakdown
      const rows = monthly_trend.map((t) => ({
        month: t.month,
        collected: t.collected,
        invoiced: t.invoiced,
      }))

      return reply.code(200).send({
        summary: {
          total_collected: totalCollected,
          outstanding,
          overdue,
          by_method: {
            stripe: stripeTotal,
            cash: cashTotal,
            check: checkTotal,
          },
        },
        monthly_trend,
        rows,
      })
    } catch (err) {
      fastify.log.error({ error: err }, 'Revenue report error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ── GET /reports/attendance ────────────────────────────────────────
  fastify.get('/reports/attendance', async (request, reply) => {
    if (!assertAdmin(request, reply)) return

    const organizationId = request.organizationId!
    const { start_date, end_date } = request.query as {
      start_date?: string
      end_date?: string
    }

    if (!start_date || !end_date) {
      return reply.code(400).send({ error: 'start_date and end_date query params required' })
    }

    try {
      // Get class sessions in the date range
      const { data: sessions, error: sessionsError } = await fastify.supabase
        .from('class_sessions')
        .select('id, class_id, session_date')
        .eq('organization_id', organizationId)
        .gte('session_date', start_date)
        .lte('session_date', end_date)

      if (sessionsError) {
        fastify.log.error({ error: sessionsError }, 'Failed to load sessions for report')
        return reply.code(500).send({ error: 'Failed to load session data' })
      }

      const allSessions = sessions ?? []
      const sessionIds = allSessions.map((s) => s.id)

      if (sessionIds.length === 0) {
        return reply.code(200).send({
          summary: {
            overall_rate: 0,
            total_records: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          },
          rows: [],
        })
      }

      // Get attendance records for those sessions
      const { data: records, error: recordsError } = await fastify.supabase
        .from('attendance_records')
        .select('id, student_id, class_session_id, status')
        .eq('organization_id', organizationId)
        .in('class_session_id', sessionIds)

      if (recordsError) {
        fastify.log.error({ error: recordsError }, 'Failed to load attendance records for report')
        return reply.code(500).send({ error: 'Failed to load attendance data' })
      }

      // Get classes for names
      const classIds = [...new Set(allSessions.map((s) => s.class_id))]
      const { data: classes, error: classesError } = await fastify.supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)

      if (classesError) {
        fastify.log.error({ error: classesError }, 'Failed to load classes for report')
        return reply.code(500).send({ error: 'Failed to load class data' })
      }

      const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]))
      const allRecords = records ?? []

      // Map session -> class_id
      const sessionClassMap = new Map(allSessions.map((s) => [s.id, s.class_id]))

      // Overall counts
      let totalPresent = 0
      let totalAbsent = 0
      let totalLate = 0
      let totalExcused = 0

      // Per-class counts
      const perClass: Record<
        string,
        { total: number; present: number; absent: number; late: number; excused: number }
      > = {}

      for (const classId of classIds) {
        perClass[classId] = { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
      }

      for (const r of allRecords) {
        const classId = sessionClassMap.get(r.class_session_id)
        if (!classId || !perClass[classId]) continue

        perClass[classId].total++

        if (r.status === 'present') {
          perClass[classId].present++
          totalPresent++
        } else if (r.status === 'absent') {
          perClass[classId].absent++
          totalAbsent++
        } else if (r.status === 'late') {
          perClass[classId].late++
          totalLate++
        } else if (r.status === 'excused') {
          perClass[classId].excused++
          totalExcused++
        }
      }

      const totalRecords = allRecords.length
      const overallRate =
        totalRecords > 0
          ? Math.round(((totalPresent + totalLate) / totalRecords) * 10000) / 100
          : 0

      // Build rows for CSV
      const rows = Object.entries(perClass).map(([classId, counts]) => {
        const rate =
          counts.total > 0
            ? Math.round(((counts.present + counts.late) / counts.total) * 10000) / 100
            : 0

        return {
          class_name: classMap.get(classId) ?? 'Unknown',
          total_records: counts.total,
          present: counts.present,
          absent: counts.absent,
          late: counts.late,
          excused: counts.excused,
          rate,
        }
      })

      rows.sort((a, b) => a.class_name.localeCompare(b.class_name))

      return reply.code(200).send({
        summary: {
          overall_rate: overallRate,
          total_records: totalRecords,
          present: totalPresent,
          absent: totalAbsent,
          late: totalLate,
          excused: totalExcused,
        },
        rows,
      })
    } catch (err) {
      fastify.log.error({ error: err }, 'Attendance report error')
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}

export default fp(reportsRoutes, {
  name: 'reports',
  dependencies: ['supabase', 'auth'],
})
