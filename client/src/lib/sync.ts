import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/**
 * drainQueue — sends all unsynced attendance records from IndexedDB to the API.
 *
 * - Reads db.attendance_queue where synced = 0, sorted by createdAt ASC
 *   (chronological order ensures first-write-wins on the server).
 * - Sends PATCH /attendance/{clientId} with X-Idempotency-Key header.
 * - Marks synced = 1 on HTTP 200 (success) or 409 (conflict — already applied).
 * - Increments retries on any other failure without marking synced.
 *
 * iOS-safe: foreground-only. No SyncManager. No BackgroundSync API.
 * Called from useSyncOnReconnect on 'online' and 'visibilitychange' events.
 *
 * Plan 03 wires the PATCH /attendance endpoint. This function is correct and
 * ready — it no-ops silently until records are queued in the attendance_queue.
 */
export async function drainQueue(): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL as string

  // Read all unsynced items in chronological order
  const pending = await db.attendance_queue
    .where('synced')
    .equals(0)
    .sortBy('createdAt')

  for (const item of pending) {
    if (!item.id) continue

    try {
      const res = await fetch(`${apiUrl}/attendance/${item.clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': item.clientId,
        },
        body: JSON.stringify({
          studentId: item.studentId,
          sessionId: item.sessionId,
          status: item.status,
        }),
      })

      if (res.ok || res.status === 409) {
        // 200 = synced; 409 = already applied idempotently — mark done
        await db.attendance_queue.update(item.id, { synced: 1 })
      } else {
        // Server error or validation failure — increment retry counter
        await db.attendance_queue.update(item.id, { retries: item.retries + 1 })
      }
    } catch {
      // Network error — increment retry counter, retry on next reconnect
      await db.attendance_queue.update(item.id, { retries: item.retries + 1 })
    }
  }
}

/**
 * useSyncOnReconnect — registers foreground sync listeners. iOS-safe.
 *
 * Listens on:
 * - window 'online'              — device regained network connectivity
 * - document 'visibilitychange'  — app foregrounded (tab or app switch on iPad)
 *
 * Calls drainQueue() immediately on mount (catches items queued while offline)
 * and on each trigger event.
 *
 * Returns { pendingCount } — live count of unsynced items from IndexedDB,
 * reactive via useLiveQuery so UI badges update without a manual refresh.
 *
 * NO SyncManager. NO BackgroundSync API. iOS Safari does not support either.
 */
export function useSyncOnReconnect(): { pendingCount: number } {
  // Live reactive count — updates automatically when attendance_queue changes
  const pendingCount =
    useLiveQuery(
      () => db.attendance_queue.where('synced').equals(0).count(),
      [],
      0
    ) ?? 0

  useEffect(() => {
    // Drain immediately on mount — catches items queued in a prior session
    drainQueue().catch(() => {
      // Non-fatal — will retry on next event trigger
    })

    const handleOnline = () => {
      drainQueue().catch(() => {})
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        drainQueue().catch(() => {})
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return { pendingCount }
}
