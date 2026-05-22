import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

/**
 * Health routes
 *
 * GET /health        — open liveness probe, no auth required
 * GET /health/authed — JWT-gated; returns role + organizationId from app_metadata
 *
 * The auth preHandler hook (registered globally in auth.ts) automatically
 * skips /health but runs for /health/authed (ends with '/authed').
 */
const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Open health check — used by Railway/Vercel health probes and curl tests
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  // Authenticated health check — proves JWT verification + app_metadata extraction works
  fastify.get('/health/authed', async (request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      role: request.role,
      organizationId: request.organizationId,
      timestamp: new Date().toISOString(),
    })
  })
}

export default fp(healthRoutes, {
  name: 'health',
})
