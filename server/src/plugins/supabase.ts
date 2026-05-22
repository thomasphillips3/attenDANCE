import fp from 'fastify-plugin'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { FastifyPluginAsync } from 'fastify'

// Augment Fastify instance to expose the service role client
declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
  }
}

/**
 * Supabase plugin — decorates the Fastify instance with a service role client.
 * The service role client bypasses RLS and is used only for server-side
 * operations where the caller's organization_id has already been verified
 * from the JWT by the auth plugin.
 *
 * NEVER expose this client's key to the browser or return it in responses.
 */
const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    )
  }

  const client = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  fastify.decorate('supabase', client)
}

export default fp(supabasePlugin, {
  name: 'supabase',
})

/**
 * Creates a per-request anon client with the caller's Bearer token injected.
 * Used by the auth plugin to call supabase.auth.getUser() which validates the
 * JWT against Supabase's current signing key (handles rotation automatically).
 *
 * A new client is created per request — do not cache or reuse across requests.
 */
export function createAnonClient(token: string): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
    )
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
