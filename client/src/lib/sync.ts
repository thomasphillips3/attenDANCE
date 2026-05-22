import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { queryClient } from '../App'

const VITE_API_URL = import.meta.env.VITE_API_URL as string

/**
 * drainQueue — sends all unsynced attendance records from IndexedDB to the server.
 *
 * - Reads db.attendance_queue where synced = 0, sorted by createdAt ASC
 *   (chronological order preserves edit sequence — e.g. absent then corrected
 *   to present arrives in the correct order, T-03-02).
 * - Sends PATCH /attendance with X-Idempotency-Key header set to item.clientId.
 * - 200 or 409: marks synced = 1 (idempotent success).
 * - 4xx (non-409): permanent failure — marks retries = 99 so we never retry.
 * - 5xx or network error: retryable — increments retries counter.
 * - After full drain: invalidates the 'roster' query so the UI refreshes.
 *
 * iOS-safe: foreground-only. No SyncManager. No BackgroundSync API.
 */
export async function drainQueue(token: string): Promise<void> {
  // Read all unsynced items in chronological order (createdAt ASC)
  const pending = await db.attendance_queue
    .where('synced')
    .equals(0)
    .sortBy('createdAt')

  for (const item of pending) {
    if (!item.id) continue

    try {
      const res = await fetch(`${VITE_API_URL}/attendance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': item.clientId,
        },
        body: JSON.stringify({
          sessionId: item.sessionId,
          studentId: item.studentId,
          status: item.status,
        }),
      })

      if (res.ok || res.status === 409) {
        // 200 = synced; 409 = already applied idempotently — mark done
        await db.attendance_queue.update(item.id, { synced: 1 })
      } else if (res.status >= 400 && res.status < 500) {
        // 4xx (non-409): permanent failure — log and do not retry
        console.warn(
          `[drainQueue] Permanent failure for clientId=${item.clientId}: HTTP ${res.status}`
        )
        await db.attendance_queue.update(item.id, { retries: 99 })
      } else {
        // 5xx: server error — retryable, increment counter
        await db.attendance_queue.update(item.id, { retries: item.retries + 1 })
      }
    } catch {
      // Network error — retryable, increment counter
      await db.attendance_queue.update(item.id, { retries: item.retries + 1 })
    }
  }

  // After full drain, invalidate roster query so UI reflects server state
  await queryClient.invalidateQueries({ queryKey: ['roster'] })
}

/**
 * useSyncOnReconnect — registers foreground sync listeners. iOS-safe.
 *
 * Listens on:
 * - window 'online'              — device regained network connectivity
 * - document 'visibilitychange'  — app foregrounded (tab or app switch on iPad)
 *
 * Calls drainQueue() immediately on mount (catches items queued while offline).
 * Calls drainQueue() on each trigger event if online and token is present.
 *
 * Returns { pendingCount } — live count of unsynced items from IndexedDB,
 * reactive via useLiveQuery so the OfflineBanner updates without a manual refresh.
 *
 * NO SyncManager. NO BackgroundSync API. iOS Safari does not support either.
 */
export function useSyncOnReconnect(token: string | undefined): { pendingCount: number } {
  // Live reactive count — updates automatically when attendance_queue changes
  const pendingCount =
    useLiveQuery(
      () => db.attendance_queue.where('synced').equals(0).count(),
      [],
      0
    ) ?? 0

  useEffect(() => {
    // Drain immediately on mount if conditions are met
    if (navigator.onLine && token) {
      drainQueue(token).catch(() => {
        // Non-fatal — will retry on next event trigger
      })
    }

    const handleOnline = () => {
      if (token) {
        drainQueue(token).catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && token) {
        drainQueue(token).catch(() => {})
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token])

  return { pendingCount }
}
