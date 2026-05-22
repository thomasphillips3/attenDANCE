import Dexie, { type Table } from 'dexie'

/**
 * Queued attendance record — written optimistically to IndexedDB before sync.
 *
 * clientId: UUID stamped at write time, sent as X-Idempotency-Key to Fastify.
 * synced: stored as 0 (false) or 1 (true) for Dexie index compatibility.
 * createdAt: Date.now() at write time — queue drains in chronological order.
 */
export interface QueuedAttendance {
  id?: number          // auto-increment primary key
  clientId: string     // UUID v4 — idempotency key for server deduplication
  studentId: string    // UUID reference to students.id
  sessionId: string    // UUID reference to class_sessions.id
  status: 'present' | 'absent' | 'late' | 'excused'
  createdAt: number    // Date.now() — stamped at write time, not sync time
  synced: 0 | 1       // 0 = pending, 1 = synced (number for Dexie index)
  retries: number      // incremented on each failed sync attempt
}

/**
 * Cached roster entry — written at login time from Fastify /sessions/today.
 * Served from IndexedDB when offline (iOS Safari 7-day cache eviction applies).
 *
 * sessionId: primary key — one entry per class session.
 * date: YYYY-MM-DD string — used to invalidate stale roster entries.
 * students: full roster array as returned by the API.
 * fetchedAt: Date.now() at fetch time — used to detect staleness.
 */
export interface CachedRoster {
  sessionId: string    // primary key — class_sessions.id UUID
  date: string         // YYYY-MM-DD e.g. '2026-05-21'
  students: unknown[]  // typed properly in Plan 02 when roster shape is defined
  fetchedAt: number    // Date.now() at cache time
}

/**
 * AttendanceDB — Dexie wrapper for the LSODance offline-first IndexedDB.
 *
 * DB name: 'lsodance_attendance'
 * Version 1 schema (Plan 01):
 *   attendance_queue — offline queue for attendance marks pending sync
 *   cached_rosters   — roster cache for offline access
 *
 * iOS Safari note: Background Sync API is NOT supported on iOS. Queue drains
 * are triggered by window.addEventListener('online', ...) and
 * document.addEventListener('visibilitychange', ...) in useSync.ts (Plan 02).
 */
export class AttendanceDB extends Dexie {
  attendance_queue!: Table<QueuedAttendance>
  cached_rosters!: Table<CachedRoster>

  constructor() {
    super('lsodance_attendance')

    this.version(1).stores({
      // attendance_queue: auto-increment id, indexed by clientId, sessionId,
      // synced (for filtering unsynced), and createdAt (for chronological drain)
      attendance_queue: '++id, clientId, sessionId, synced, createdAt',

      // cached_rosters: sessionId is the primary key; date index for staleness checks
      cached_rosters: 'sessionId, date',
    })
  }
}

/**
 * Singleton db instance — import this everywhere instead of constructing a new DB.
 * Dexie opens the IndexedDB connection lazily on first query.
 */
export const db = new AttendanceDB()
