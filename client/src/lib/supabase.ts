import { createClient } from '@supabase/supabase-js'

/**
 * Supabase anon client singleton for the browser.
 *
 * Uses the public anon key — safe to expose in client code.
 * Row Level Security policies enforce data isolation on the server.
 *
 * NEVER use the service role key on the client.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage so iPad remembers login across refreshes (AUTH-02)
    persistSession: true,
    autoRefreshToken: true,
    // detectSessionInUrl must be true for magic link auth (parent portal).
    // When a parent clicks the magic link, Supabase appends auth tokens to
    // the URL hash — the client must detect and exchange them for a session.
    detectSessionInUrl: true,
  },
})
