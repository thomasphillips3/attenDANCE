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
 * migration 003 (updated in 009) injects these values at JWT mint time.
 *
 * Parent users also get family_id injected by the hook (migration 009).
 * This is attached to request.familyId so parent routes can scope queries
 * to the parent's own family without trusting request parameters.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const url = request.url

    // Allow open health check — skip auth for /health but NOT /health/authed
    if (url.startsWith('/health') && !url.endsWith('/authed')) {
      return
    }

    // Skip auth for webhook routes — Stripe calls these directly, no JWT
    if (url.startsWith('/webhooks')) {
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

    // Decode JWT payload to read hook-injected claims from app_metadata.
    // getUser() returns the DB row which does NOT include hook-injected fields.
    // The Custom Access Token Hook writes role + organization_id into the JWT
    // at mint time — we must read them from the token itself.
    let jwtAppMetadata: Record<string, unknown> = {}
    try {
      const payloadB64 = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
      jwtAppMetadata = payload.app_metadata ?? {}
    } catch {
      jwtAppMetadata = user.app_metadata ?? {}
    }

    // Attach verified claims to the request — sourced from JWT app_metadata only
    request.user = user
    request.organizationId = jwtAppMetadata.organization_id as string | undefined
    request.role = jwtAppMetadata.role as string | undefined
    // Parent users get family_id from the hook (migration 009)
    request.familyId = jwtAppMetadata.family_id as string | undefined
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['supabase'],
})
