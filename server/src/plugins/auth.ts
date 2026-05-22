import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { createAnonClient } from './supabase.js'

/**
 * Auth plugin — registers a global preHandler hook that verifies Supabase JWTs.
 *
 * Skip logic: routes whose URL starts with '/health' and does NOT end with
 * '/authed' are open (e.g. GET /health). GET /health/authed requires a token.
 *
 * Roles and organizationId are read from app_metadata ONLY — never from
 * user_metadata, which is user-writable. The Custom Access Token Hook in
 * migration 003 injects these values at JWT mint time.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const url = request.url

    // Allow open health check — skip auth for /health but NOT /health/authed
    if (url.startsWith('/health') && !url.endsWith('/authed')) {
      return
    }

    // Extract Bearer token
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing authorization header' })
    }

    const token = authHeader.slice(7) // strip "Bearer "

    // Verify the token by calling Supabase Auth (validates signature + expiry)
    const anonClient = createAnonClient(token)
    const { data: { user }, error } = await anonClient.auth.getUser()

    if (error || !user) {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }

    // Attach verified claims to the request — sourced from app_metadata only
    request.user = user
    request.organizationId = user.app_metadata?.organization_id as string | undefined
    request.role = user.app_metadata?.role as string | undefined
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['supabase'],
})
