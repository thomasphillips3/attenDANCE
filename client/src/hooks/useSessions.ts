import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { db } from '../lib/db'

/**
 * SessionSummary shape returned by GET /sessions/today.
 * Mirrors the TypeBox schema in server/src/types/index.ts.
 */
export interface SessionSummary {
  id: string
  classId: string
  className: string
  instructorName?: string
  startTime: string         // "HH:MM" 24h
  durationMinutes: number
  sessionDate: string       // "YYYY-MM-DD"
  status: 'scheduled' | 'completed' | 'cancelled'
  presentCount: number
  totalEnrolled: number
}

/**
 * useSessions — fetches today's class sessions from the Fastify API.
 *
 * On success: writes a stub cached_roster entry per session to IndexedDB so
 * the session is findable offline. Full student list written by useRoster when
 * the Roster screen is visited.
 *
 * On network failure: sets isOffline: true. The session list cannot be
 * reconstructed from stubs alone (no class metadata cached), so ClassList
 * shows an offline empty state — the user can still tap any card they saw
 * before (Roster has its own offline fallback via useRoster).
 */
export function useSessions(): {
  sessions: SessionSummary[]
  isLoading: boolean
  isOffline: boolean
} {
  const { session } = useAuth()
  const token = session?.access_token

  const [offlineSessions, setOfflineSessions] = useState<SessionSummary[]>([])

  const { data, isLoading, isError } = useQuery<SessionSummary[]>({
    queryKey: ['sessions', 'today'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/sessions/today`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.status}`)
      }

      const sessions: SessionSummary[] = await res.json()

      // Cache stub entries per session — full student list written by useRoster
      const today = new Date().toISOString().slice(0, 10)
      await Promise.all(
        sessions.map((s) =>
          db.cached_rosters.put({
            sessionId: s.id,
            date: today,
            students: [],
            fetchedAt: Date.now(),
          })
        )
      )

      return sessions
    },
    enabled: !!token,
    retry: false,
  })

  // On network error fall back to IndexedDB — we can only return stubs here
  // since cached_rosters doesn't store session metadata (class name, time, etc.)
  // ClassList will show an offline indicator with an empty list, but Roster
  // retains its own full offline fallback via useRoster.
  useEffect(() => {
    if (!isError) return
    db.cached_rosters
      .toArray()
      .then(() => setOfflineSessions([]))
      .catch(() => setOfflineSessions([]))
  }, [isError])

  return {
    sessions: data ?? offlineSessions,
    isLoading,
    isOffline: isError,
  }
}
