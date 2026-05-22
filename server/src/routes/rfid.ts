import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { RfidCheckinBody } from '../types/index.js'

/**
 * RFID routes
 *
 * POST /rfid/checkin — ATTN-08 contract stub for Phase 2 hardware integration.
 *
 * This endpoint reserves the URL and validates the request shape so the
 * RFID reader firmware can target a stable contract in Phase 2.
 *
 * Behavior:
 * - Requires a valid JWT (auth preHandler runs)
 * - Validates that card_uid is present in the body (400 if missing)
 * - Returns 501 with a clear "not yet implemented" message — no DB writes
 *
 * Security (T-04-03): card_uid is echoed in the 501 body. card_uid is a
 * hardware UID containing no PII. The response is returned only to
 * authenticated callers (auth preHandler ensures this).
 */
const rfidRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Partial<RfidCheckinBody> }>('/rfid/checkin', async (request, reply) => {
    // Validate required field
    const { card_uid } = request.body ?? {}
    if (!card_uid) {
      return reply.code(400).send({ error: 'card_uid is required' })
    }

    // 501: hardware integration is reserved for Phase 2 (ATTN-08)
    return reply.code(501).send({
      error: 'RFID check-in not yet implemented',
      message: `Hardware integration pending Phase 2. card_uid received: ${card_uid}`,
    })
  })
}

export default fp(rfidRoutes, {
  name: 'rfid',
  dependencies: ['supabase', 'auth'],
})
