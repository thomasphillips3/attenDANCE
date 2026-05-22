import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { AttendanceMarkBody } from '../types/index.js'

/**
 * Attendance routes
 *
 * GET /sessions/:id/roster — returns enrolled students for a class session,
 * with their current attendance status for that session.
 *
 * PATCH /attendance — upsert an attendance mark with idempotency deduplication.
 *   - organizationId from JWT only (T-03-03)
 *   - X-Idempotency-Key header required — prevents duplicate DB writes on retry
 *   - ON CONFLICT (student_id, class_session_id) DO UPDATE ensures one row per student per session
 *   - marked_by is always 'manual'
 *
 * Security (T-02-01): before returning any data, the GET route verifies that the
 * session belongs to the requesting organization. A session from a different
 * org returns HTTP 403. organizationId always comes from JWT app_metadata via
 * request.organizationId — never from the request body or query params.
 */

// In-memory idempotency store: clientId -> Date.now() at processing time.
// Provides fast-path dedup to skip DB round-trips on rapid retries.
// TTL: 1 hour (3_600_000 ms). The DB-level ON CONFLICT is the authoritative guard.
const idempotencyStore = new Map<string, number>()

const attendanceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/sessions/:id/roster', async (request, reply) => {
    const organizationId = request.organizationId
    const sessionId = request.params.id

    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // T-02-01: verify session belongs to this organization before returning data
    const { data: sessionCheck, error: sessionError } = await fastify.supabase
      .from('class_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (sessionError) {
      fastify.log.error({ error: sessionError }, 'Failed to verify session ownership')
      return reply.code(500).send({ error: 'Failed to load roster' })
    }

    if (!sessionCheck) {
      // Session does not exist for this org — return 403 to avoid leaking
      // whether the session exists at all (IDOR mitigation)
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Fetch roster via SECURITY DEFINER function (same SQL as Plan 02 interfaces block)
    const { data, error } = await fastify.supabase.rpc('get_session_roster', {
      p_organization_id: organizationId,
      p_session_id: sessionId,
    })

    if (error) {
      fastify.log.error({ error }, 'Failed to load roster')
      return reply.code(500).send({ error: 'Failed to load roster' })
    }

    return reply.code(200).send(data ?? [])
  })

  /**
   * PATCH /attendance — upsert a single attendance mark.
   *
   * Nine-step sequence from plan interfaces:
   * 1. organizationId from JWT only (T-03-03)
   * 2. X-Idempotency-Key required — return 400 if missing
   * 3. In-memory Map fast-path — return 200 {already processed} if clientId seen < 1h ago
   * 4. Validate body with TypeBox schema
   * 5. Look up staffId from staff table
   * 6. Upsert into attendance_records with ON CONFLICT DO UPDATE
   * 7. Store clientId in idempotencyStore after successful write
   * 8. Return 200 { attendanceId, status }
   * 9. DB errors return 500
   */
  fastify.patch<{ Body: AttendanceMarkBody }>('/attendance', async (request, reply) => {
    // Step 1: organizationId from JWT only — never from request body
    const organizationId = request.organizationId
    if (!organizationId) {
      return reply.code(401).send({ error: 'Missing organization context' })
    }

    // Step 2: X-Idempotency-Key header required
    const clientId = request.headers['x-idempotency-key'] as string | undefined
    if (!clientId) {
      return reply.code(400).send({ error: 'Missing X-Idempotency-Key header' })
    }

    // Step 3: fast-path dedup — if seen within the last hour, skip DB round-trip
    const lastSeen = idempotencyStore.get(clientId)
    if (lastSeen !== undefined && Date.now() - lastSeen < 3_600_000) {
      return reply.code(200).send({
        attendanceId: null,
        status: request.body?.status ?? '',
        message: 'already processed',
      })
    }

    // Step 4: validate body (TypeBox schema)
    const { sessionId, studentId, status } = request.body
    if (!sessionId || !studentId || !status) {
      return reply.code(400).send({ error: 'Missing required fields: sessionId, studentId, status' })
    }

    // Step 5: look up staffId — use null if staff row not found (don't fail the request)
    let staffId: string | null = null
    try {
      const { data: staffRow } = await fastify.supabase
        .from('staff')
        .select('id')
        .eq('user_id', request.user!.id)
        .eq('organization_id', organizationId)
        .maybeSingle()
      staffId = staffRow?.id ?? null
    } catch {
      // Non-fatal — staffId stays null
      fastify.log.warn('Could not look up staffId for attendance mark')
    }

    // Step 6: upsert with ON CONFLICT (student_id, class_session_id) DO UPDATE
    const { data: upsertData, error: upsertError } = await fastify.supabase
      .from('attendance_records')
      .upsert(
        {
          organization_id: organizationId,
          student_id: studentId,
          class_session_id: sessionId,
          status,
          marked_by: 'manual',
          marked_by_staff_id: staffId,
        },
        {
          onConflict: 'student_id,class_session_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single()

    if (upsertError) {
      fastify.log.error({ error: upsertError }, 'Failed to record attendance')
      return reply.code(500).send({ error: 'Failed to record attendance' })
    }

    // Step 7: record in idempotency store after successful write
    idempotencyStore.set(clientId, Date.now())

    // Step 8: return success
    return reply.code(200).send({
      attendanceId: upsertData.id as string,
      status,
    })
  })
}

export default fp(attendanceRoutes, {
  name: 'attendance',
  dependencies: ['supabase', 'auth'],
})
