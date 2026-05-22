import { useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UseAuthReturn {
  session: Session | null
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: Error | null }>
  logout: () => Promise<void>
}

/**
 * useAuth — session state, login, and logout.
 *
 * AUTH-02 compliance: calls getSession() on mount to restore persisted session
 * from localStorage. iPad users do not need to re-login after a page refresh.
 *
 * The onAuthStateChange subscription keeps state in sync with Supabase's
 * automatic token refresh (runs before token expiry).
 */
export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore persisted session on mount (AUTH-02: no re-login after refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Subscribe to auth state changes (token refresh, sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const login = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      // Trigger service worker update check on login (PITFALLS.md Pitfall 12)
      // Ensures the PWA updates itself when the user returns after a deployment
      navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {
          // Non-fatal — SW may not be registered in dev mode
        })
    }

    return { error: error as Error | null }
  }

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut()
  }

  return { session, user, loading, login, logout }
}
