---
phase: 01-attendance-mvp
plan: 02
subsystem: class-list-and-roster
tags: [fastify, supabase-rpc, tanstack-query, dexie, zustand, indexeddb, offline, ios-safe-sync]
dependency_graph:
  requires: [01-01]
  provides: [sessions-api, roster-api, class-list-screen, roster-screen, sync-queue-hook]
  affects: [01-03, 01-04]
tech_stack:
  added:
    - zustand 5.x (selectedSessionId navigation atom)
    - Supabase SECURITY DEFINER PostgreSQL functions (get_sessions_today, get_session_roster)
  patterns:
    - supabase.rpc() for complex JOIN + aggregate queries (supabase-js has no raw SQL)
    - TanStack Query with IndexedDB fallback on network error
    - Optimistic local state (localStatus) initialized from API, updated immediately on tap
    - Foreground-only sync via window 'online' + document 'visibilitychange' (no BackgroundSync)
key_files:
  created:
    - supabase/migrations/20260522000500_api_functions.sql
    - server/src/routes/sessions.ts
    - server/src/routes/attendance.ts
    - client/src/store.ts
    - client/src/hooks/useSessions.ts
    - client/src/hooks/useRoster.ts
    - client/src/components/ClassCard.tsx
    - client/src/components/StudentRow.tsx
    - client/src/lib/sync.ts
  modified:
    - server/src/types/index.ts
    - server/src/index.ts
    - client/src/screens/ClassList.tsx
    - client/src/screens/Roster.tsx
    - client/src/App.tsx
decisions:
  - "supabase-js has no raw SQL method — wrapped plan SQL as SECURITY DEFINER PostgreSQL functions called via supabase.rpc(); identical SQL, no new npm packages"
  - "typebox installed as 'typebox' not '@sinclair/typebox' — fixed import in server/src/types/index.ts"
  - "Roster stub created in Task 2 so App.tsx import resolves before Task 3 full implementation"
  - "offlineStudents in useSessions returns empty array — cached_roster stubs have no session metadata to reconstruct ClassList from; Roster has its own full offline fallback via useRoster"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  files_created: 9
  files_modified: 5
---

# Phase 1 Plan 2: Class List and Roster Display Summary

Fastify API routes for today's sessions and per-class rosters, wired end-to-end through TanStack Query to ClassList and Roster screens with IndexedDB caching and an iOS-safe foreground sync queue hook.

## What Was Built

### Task 1 — Fastify API Routes (commit 3bbb331)

- **supabase/migrations/20260522000500_api_functions.sql** — Two `SECURITY DEFINER` PostgreSQL functions wrapping the exact SQL from the plan interfaces block: `get_sessions_today(p_organization_id)` and `get_session_roster(p_organization_id, p_session_id)`. Called via `fastify.supabase.rpc()` since supabase-js has no raw SQL method.
- **server/src/routes/sessions.ts** — `GET /sessions/today` Fastify plugin. `organizationId` sourced from JWT only (T-02-01). Returns `SessionSummary[]` with bigint counts coerced to numbers.
- **server/src/routes/attendance.ts** — `GET /sessions/:id/roster` Fastify plugin. Verifies session ownership against `organizationId` before data is returned; responds 403 on mismatch (IDOR mitigation T-02-01). Returns `RosterStudent[]`.
- **server/src/types/index.ts** — Extended with `SessionSummary` and `RosterStudent` TypeBox schemas. Fixed `@sinclair/typebox` → `typebox` import.
- **server/src/index.ts** — Registers `sessionsRoutes` and `attendanceRoutes`.

### Task 2 — ClassList Screen (commit 17022fa)

- **client/src/store.ts** — Zustand store with `selectedSessionId` atom and `setSelectedSessionId` setter. Navigation: null = ClassList, non-null = Roster.
- **client/src/hooks/useSessions.ts** — TanStack Query hook (queryKey: `['sessions', 'today']`). Writes IndexedDB stub entries on success; sets `isOffline: true` on network error.
- **client/src/components/ClassCard.tsx** — Tappable class tile (min-height 80px). Status badge: green done, purple "In Progress" pill, grey dot. Full card is click target with `role="button"` and keyboard support.
- **client/src/screens/ClassList.tsx** — Full implementation replacing Plan 01 shell. Spinner while loading, ClassCard list, "No classes scheduled for today" empty state, offline banner, correct header (TODAY label / date DM Serif Display 42px / greeting 34px italic purple / LSODance logotype), footer with email.
- **client/src/App.tsx** — Added `useStore` and `Roster` import; renders `<Roster>` when `selectedSessionId` non-null, `<ClassList>` when null.

### Task 3 — Roster Screen + Sync Hook (commit c464055)

- **client/src/hooks/useRoster.ts** — TanStack Query hook (queryKey: `['roster', sessionId]`). Writes full student list to `db.cached_rosters` on success; reads from cache on network error (offline fallback).
- **client/src/components/StudentRow.tsx** — Student row with `min-height: 56px`. Four status buttons (P/A/L/E) each `min-width: 56px, min-height: 56px`. Active = filled semantic color (green/red/gold/purple), inactive = outlined. `aria-label` on every button.
- **client/src/screens/Roster.tsx** — Full implementation. Back arrow (56px touch target), class name + time header, live present/absent counts from `localStatus`, scrollable student list with `StudentRow`. `onMark` updates local state immediately — Plan 03 adds the IndexedDB write + API call.
- **client/src/lib/sync.ts** — `drainQueue()` reads `attendance_queue` where `synced=0` sorted by `createdAt ASC`, sends `PATCH /attendance/{clientId}` with `X-Idempotency-Key`, marks `synced=1` on HTTP 200/409. `useSyncOnReconnect()` registers `window 'online'` and `document 'visibilitychange'` listeners, drains on mount and on each event. Returns `{ pendingCount }` via `useLiveQuery`. Zero `SyncManager` / `BackgroundSync` code references.
- **client/src/App.tsx** — Added `useSyncOnReconnect()` call at top level of `AppContent` so listeners are always active.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] supabase-js has no raw SQL execution method**
- **Found during:** Task 1 implementation
- **Issue:** Plan specifies "execute the parameterized SQL query" but `@supabase/supabase-js` exposes no `.query()` or raw SQL method. No `pg`/`postgres` package is installed, and installing an unverified package is excluded from Rule 3 auto-fix.
- **Fix:** Wrapped both SQL queries as `SECURITY DEFINER` PostgreSQL functions in migration `20260522000500_api_functions.sql`. Called via `fastify.supabase.rpc()`. Identical SQL execution, no new npm packages.
- **Files modified:** `supabase/migrations/20260522000500_api_functions.sql`, `server/src/routes/sessions.ts`, `server/src/routes/attendance.ts`
- **Commit:** 3bbb331

**2. [Rule 1 - Bug] @sinclair/typebox import path incorrect**
- **Found during:** Task 1 — `npx tsc --noEmit` in server/
- **Issue:** `server/src/types/index.ts` imported from `@sinclair/typebox` but the installed package (peer dep of `@fastify/type-provider-typebox` v6) is named `typebox`
- **Fix:** Changed `from '@sinclair/typebox'` to `from 'typebox'`
- **Files modified:** `server/src/types/index.ts`
- **Commit:** 3bbb331

**3. [Rule 3 - Blocking] Roster.tsx stub needed for Task 2 build verification**
- **Found during:** Task 2 — `App.tsx` imports `Roster` before it exists
- **Issue:** Task 2 verify step runs `npm run build`; missing `Roster` import would cause TS error, failing the 0-error check
- **Fix:** Created typed stub `Roster.tsx` with correct `{ sessionId, onBack }` interface in Task 2; replaced with full implementation in Task 3
- **Files:** `client/src/screens/Roster.tsx`
- **Commits:** 17022fa (stub), c464055 (full)

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `onMark` only updates `localStatus` | `client/src/screens/Roster.tsx` line 62 | IndexedDB write + PATCH API call added in Plan 03 (ATTN-03) |
| `drainQueue` no-ops until records queued | `client/src/lib/sync.ts` line 17 | PATCH /attendance endpoint wired in Plan 03 |

Both stubs are correct-by-design for this plan. The plan goal (display roster, update count display on tap) is fully achieved. The persistence write path is explicitly Plan 03 scope per the plan's `<done>` criteria.

## Threat Flags

None — no new threat surface beyond the plan's threat model. Both new API endpoints apply the T-02-01 IDOR mitigation (session ownership verified before data returned). `organizationId` sourced from JWT only on both routes.

## Self-Check: PASSED

Files verified present:
- supabase/migrations/20260522000500_api_functions.sql: FOUND
- server/src/routes/sessions.ts: FOUND
- server/src/routes/attendance.ts: FOUND
- client/src/store.ts: FOUND
- client/src/hooks/useSessions.ts: FOUND
- client/src/hooks/useRoster.ts: FOUND
- client/src/components/ClassCard.tsx: FOUND
- client/src/components/StudentRow.tsx: FOUND
- client/src/lib/sync.ts: FOUND
- client/src/screens/ClassList.tsx: FOUND (replaced)
- client/src/screens/Roster.tsx: FOUND (replaced)

Commits verified:
- 3bbb331 (Task 1): FOUND
- 17022fa (Task 2): FOUND
- c464055 (Task 3): FOUND
