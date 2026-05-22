import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { db } from '../lib/db'

/**
 * RosterStudent shape returned by GET /sessions/:id/roster.
 * Mirrors the TypeBox schema in server/src/types/index.ts.
 */
export interface RosterStudent {
  studentId: string
  enrollmentId: string
  firstName: string
  lastName: string
  attendanceId?: string
  attendanceStatus?: 'present' | 'absent' | 'late' | 'excused'
}

/**
 * useRoster — fetches enrolled students for a single class session.
 *
 * On success: writes the full student list to IndexedDB cached_rosters so the
 * roster is available offline if the device loses connectivity mid-session.
 *
 * On network failure: reads from db.cached_rosters.get(sessionId) and returns
 * isOffline: true so the Roster screen can show an offline indicator.
 */
export function useRoster(sessionId: string): {
  students: RosterStudent[]
  isLoading: boolean
  isOffline: boolean
} {
  const { session } = useAuth()
  const token = session?.access_token

  const [offlineStudents, setOfflineStudents] = useState<RosterStudent[]>([])

  const { data, isLoading, isError } = useQuery<RosterStudent[]>({
    queryKey: ['roster', sessionId],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/sessions/${sessionId}/roster`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch roster: ${res.status}`)
      }

      const students: RosterStudent[] = await res.json()

      // Write full roster to IndexedDB for offline access
      await db.cached_rosters.put({
        sessionId,
        date: new Date().toISOString().slice(0, 10),
        students,
        fetchedAt: Date.now(),
      })

      return students
    },
    enabled: !!token && !!sessionId,
    retry: false,
  })

  // On network error fall back to IndexedDB cached roster
  useEffect(() => {
    if (!isError) return
    db.cached_rosters
      .get(sessionId)
      .then((cached) => {
        if (cached?.students) {
          setOfflineStudents(cached.students as RosterStudent[])
        }
      })
      .catch(() => setOfflineStudents([]))
  }, [isError, sessionId])

  return {
    students: data ?? offlineStudents,
    isLoading,
    isOffline: isError,
  }
}
