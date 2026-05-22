---
phase: 01-attendance-mvp
plan: 03
subsystem: attendance-sync
tags: [offline-first, optimistic-ui, idempotency, indexeddb, ios-safe]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [attendance-mark-api, optimistic-ui, offline-queue-drain, offline-banner]
  affects: [server/src/routes/attendance.ts, client/src/screens/Roster.tsx, client/src/lib/sync.ts, client/src/components/OfflineBanner.tsx]
tech_stack:
  added: []
  patterns:
    - Optimistic UI with IndexedDB durability before network call
    - Idempotency key fast-path (in-memory Map) + DB-level ON CONFLICT dedup
    - iOS-safe foreground sync via online + visibilitychange events (no BackgroundSync)
    - Reactive pending count via useLiveQuery (Dexie)
key_files:
  created:
    - client/src/components/OfflineBanner.tsx
  modified:
    - server/src/routes/attendance.ts
    - server/src/types/index.ts
    - client/src/screens/Roster.tsx
    - client/src/lib/sync.ts
    - client/src/App.tsx
decisions:
  - queryClient exported from App.tsx to share the single React Query cache with sync.ts
  - drainQueue accepts token as parameter for explicit dependency and testability
  - 4xx non-409 responses set retries=99 as permanent-failure sentinel (never retried)
  - sync.ts comment-only references to SyncManager/BackgroundSync document the iOS constraint
metrics:
  duration: ~25 minutes
  completed: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
---

# Phase 1 Plan 3: Attendance Mark, Offline Queue, and Sync Summary

**One-liner:** PATCH /attendance upsert with idempotency dedup, optimistic IndexedDB-first marking in Roster, and iOS-safe foreground drainQueue with reactive OfflineBanner.

## What Was Built

### Task 1: PATCH /attendance — Upsert with Idempotency Key Deduplication

Added `AttendanceMarkBody` and `AttendanceMarkResponse` TypeBox schemas to `server/src/types/index.ts`.

Extended `server/src/routes/attendance.ts` with a module-level `idempotencyStore = new Map<string, number>()` and a PATCH handler following the nine-step contract:

1. organizationId from JWT only (T-03-03 — never from body)
2. X-Idempotency-Key header required — 400 if missing
3. In-memory Map fast-path dedup (1h TTL) — returns `{ message: 'already processed' }` on hit
4. Body validation
5. staffId lookup via `SELECT id FROM staff WHERE user_id = $userId AND org = $orgId` (null if not found — non-fatal)
6. Upsert with `ON CONFLICT (student_id, class_session_id) DO UPDATE SET status, marked_by = 'manual', updated_at = now()` — one row per student per session
7. Store clientId in Map after successful write
8. Return `{ attendanceId, status }`
9. DB errors return 500

Verified: PATCH without Authorization returns 401. Server TypeScript build: 0 errors.

### Task 2: Roster Optimistic Marking — IndexedDB Write First, Async API Sync

Replaced the `handleMark` stub in `client/src/screens/Roster.tsx` with full four-step `onMark`:

- **Step 1:** `setLocalStatus` synchronously — UI updates before any I/O
- **Step 2:** `crypto.randomUUID()` stamped at tap time
- **Step 3:** `await db.attendance_queue.add({ ..., createdAt: Date.now(), synced: 0, retries: 0 })` — durable before any fetch
- **Step 4:** Fire-and-forget IIFE if `navigator.onLine && token` — marks `synced: 1` on 200/409

`createdAt = Date.now()` is called inside `onMark` directly, not inside any callback or setTimeout. This preserves tap-time ordering for correct queue replay (T-03-02 / PITFALLS.md Pitfall 1).

`presentCount` counts both `'present'` and `'late'` as attended (ATTN-04). `absentCount` counts only `'absent'`.

Client build: 0 TypeScript errors.

### Task 3: Full drainQueue, OfflineBanner, App.tsx Wiring

**`client/src/lib/sync.ts`** — full implementation replacing the Plan 02 stub:

- `drainQueue(token)`: reads unsynced queue sorted by `createdAt` ASC, sends `PATCH /attendance` with `X-Idempotency-Key` header; 200/409 → `synced: 1`; 4xx non-409 → `retries: 99` (permanent, logged with `console.warn`); 5xx or network error → `retries + 1` (retryable). After drain: `queryClient.invalidateQueries({ queryKey: ['roster'] })`.
- `useSyncOnReconnect(token)`: registers `window 'online'` and `document 'visibilitychange'` listeners; drains immediately on mount if online and token present; returns reactive `pendingCount` via `useLiveQuery`. Zero functional references to SyncManager or BackgroundSync.

**`client/src/components/OfflineBanner.tsx`** — new component:
- Returns `null` when `pendingCount === 0`
- Fixed bottom-0, full-width, z-50
- Background `#f3e3b8`, text `#6e521a`, 14px, padding 10px 24px
- SVG sync icon + `"{N} record(s) pending sync"` text

**`client/src/App.tsx`** updates:
- `queryClient` exported so `sync.ts` can call `invalidateQueries` against the shared cache
- `useSyncOnReconnect(session?.access_token)` — token passed explicitly
- `<OfflineBanner pendingCount={pendingCount} />` rendered at root level inside auth gate

Client build: 0 TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written.

**Note on verification check:** The plan's `grep -c "SyncManager|BackgroundSync|sync.register"` check returns 2 (not 0) because both matches are in JSDoc comment lines that explicitly document these APIs are NOT used (`* No SyncManager.`, `* NO BackgroundSync API.`). There are zero functional or import references to those APIs. This is correct and intentional — the comment text preserves the iOS constraint rationale for future maintainers.

## Decisions Made

1. **queryClient exported from App.tsx** rather than re-instantiated in sync.ts or passed as a parameter to `drainQueue`. Sharing the single React Query cache instance ensures `invalidateQueries` refreshes the same cache the UI components read from.

2. **drainQueue accepts `token` as a parameter** rather than reading from a closure. This makes the dependency explicit and keeps the function independently testable.

3. **retries: 99 as permanent-failure sentinel** for 4xx non-409 responses. A high sentinel value is simpler than a boolean field and avoids a Dexie schema migration.

## Known Stubs

None. All data flows are wired end-to-end: tap -> localStatus -> IndexedDB -> PATCH -> DB row.

## Threat Surface Scan

No new trust boundaries beyond those declared in the plan's threat model. PATCH /attendance is the new surface — T-03-01 through T-03-03 mitigations all implemented: idempotency dedup, chronological ordering, organizationId from JWT only.

## Self-Check: PASSED

- `server/src/routes/attendance.ts` — exists, contains PATCH handler
- `server/src/types/index.ts` — exists, contains AttendanceMarkBody schema
- `client/src/screens/Roster.tsx` — exists, contains `attendance_queue.add` and `Date.now()`
- `client/src/lib/sync.ts` — exists, contains `sortBy` and `visibilitychange`
- `client/src/components/OfflineBanner.tsx` — exists (created this plan)
- `client/src/App.tsx` — exists, exports `queryClient`, renders `OfflineBanner`
- Commits f11434b, 530039c, 6d4b2d9 all present in git log
- Client build: 0 TypeScript errors
- Server build: 0 TypeScript errors
- PATCH /attendance without auth: 401
