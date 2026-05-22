---
phase: 1
plan: 1
subsystem: foundation
tags: [supabase, fastify, vite, react, pwa, rls, auth, dexie, tailwind]
dependency_graph:
  requires: []
  provides: [supabase-schema, rls-policies, auth-hook, fastify-server, vite-pwa-client]
  affects: [01-02, 01-03, 01-04]
tech_stack:
  added:
    - Supabase (PostgreSQL + Auth + RLS)
    - Fastify 5.x (API server, JWT auth middleware)
    - Vite 8 + React 19 + TypeScript
    - Tailwind CSS v4 (@tailwindcss/vite plugin)
    - vite-plugin-pwa (Workbox service worker)
    - Dexie 4 (IndexedDB — attendance_queue + cached_rosters)
    - "@tanstack/react-query 5"
    - react-hook-form + zod (login form validation)
    - date-fns 4 (date formatting)
  patterns:
    - Multi-tenant RLS with JWT subselect caching
    - Custom Access Token Auth Hook (PostgreSQL function)
    - Offline-first IndexedDB schema (Plan 02 drains the queue)
    - Session-gated React routing (loading / Login / ClassList)
key_files:
  created:
    - supabase/config.toml
    - supabase/migrations/20260521_001_schema.sql
    - supabase/migrations/20260521_002_rls.sql
    - supabase/migrations/20260521_003_auth_hook.sql
    - supabase/migrations/20260521_004_seed.sql
    - server/package.json
    - server/tsconfig.json
    - server/src/index.ts
    - server/src/types/index.ts
    - server/src/plugins/supabase.ts
    - server/src/plugins/auth.ts
    - server/src/plugins/cors.ts
    - server/src/routes/health.ts
    - server/.env
    - client/vite.config.ts
    - client/src/styles/index.css
    - client/src/lib/supabase.ts
    - client/src/lib/db.ts
    - client/src/hooks/useAuth.ts
    - client/src/screens/Login.tsx
    - client/src/screens/ClassList.tsx
    - client/src/App.tsx
    - client/src/main.tsx
    - client/public/manifest.webmanifest
    - client/public/icon-192.png
    - client/public/icon-512.png
    - client/.env.local
    - .gitignore
  modified: []
decisions:
  - "RLS policies use subselect pattern: (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) to prevent per-row JWT re-evaluation"
  - "Custom Access Token Hook injects role + organization_id into app_metadata at JWT mint time; requires manual dashboard registration"
  - "organizations table gets authenticated-read-only RLS (SELECT auth.uid() IS NOT NULL) since it has no organization_id column"
  - "tsx watch --env-file=.env flag order: env-file flag must come after the watch subcommand, not before it"
  - "Google Fonts @import statements must precede @import tailwindcss to satisfy CSS @import ordering rules"
metrics:
  duration: "~4 hours"
  completed: "2026-05-21"
  tasks_completed: 3
  files_created: 27
---

# Phase 1 Plan 1: Walking Skeleton Summary

Supabase schema + RLS + Auth Hook migrations, Fastify 5 API scaffold with JWT auth middleware, and Vite + React + Tailwind v4 PWA with login screen and ClassList shell.

## What Was Built

### Task 1 — Supabase Migrations (commit bde042b)

Four migration files establish the complete multi-tenant schema:

- **20260521_001_schema.sql** — 13 ENUMs, 21 tables including `attendance_records`, `rfid_cards`, all billing/comms/events tables. Every table has `organization_id uuid NOT NULL` for tenant isolation.
- **20260521_002_rls.sql** — ENABLE + FORCE RLS on all tables. All policies use the subselect caching pattern to prevent per-row JWT re-evaluation. Staff write policies check both `organization_id` and `role IN ('admin', 'front_desk', 'instructor')`.
- **20260521_003_auth_hook.sql** — `custom_access_token_hook(event jsonb)` PostgreSQL function that injects `role` and `organization_id` into `app_metadata` at JWT mint time. Requires manual registration in Supabase Dashboard > Authentication > Hooks.
- **20260521_004_seed.sql** — Idempotent seed (guards with `IF EXISTS SELECT 1 FROM organizations`). Seeds LaShelle School of Dance (Oak Park, MI), 3 classes, 3 class_sessions for CURRENT_DATE, 10 Hip Hop Intermediate students, 10 enrollments. Does NOT insert into auth.users.

### Task 2 — Fastify API Scaffold (commit 09a9247)

- **Global preHandler auth middleware** reads `Authorization: Bearer <token>`, calls `createAnonClient(token).auth.getUser()`, sets `request.user / organizationId / role` from `app_metadata`. Skips routes not ending in `/authed`.
- **GET /health** — open, returns `{ status: 'ok', timestamp }`.
- **GET /health/authed** — JWT-gated, returns `{ status: 'ok', role, organizationId, timestamp }`.
- **fastify.supabase** decoration — service role client for server-side operations.
- **tsx watch --env-file=.env** — env loading fix (flag must follow `watch` subcommand).

### Task 3 — Vite PWA Client (commit 9eed29d)

- **Tailwind v4** via `@tailwindcss/vite` plugin (no PostCSS, no tailwind.config.js). Full `@theme` block with brand tokens.
- **useAuth** hook — `getSession()` on mount (AUTH-02: session persists across iPad refreshes), `onAuthStateChange` subscription, SW update trigger on login.
- **Login screen** — react-hook-form + zodResolver, LSO*Dance* logotype (DM Serif Display italic), 56px email/password inputs, purple submit button, inline error display.
- **ClassList shell** — `date-fns format(today, 'EEEE, MMMM d, yyyy')` date header, time-of-day greeting in purple italic 34px, empty state "Loading classes...", sign-out button in footer.
- **App.tsx** — `QueryClientProvider` wrapper, session-gated routing (loading spinner / Login / ClassList).
- **PWA** — `vite-plugin-pwa` with Workbox `generateSW`, manifest.webmanifest, placeholder purple 192x512 icons.
- **Build verified** — `tsc -b && vite build` exits 0, zero TypeScript errors, zero CSS warnings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsx --env-file flag order**
- **Found during:** Task 2 verification
- **Issue:** `tsx --env-file=.env watch src/index.ts` failed with ERR_MODULE_NOT_FOUND — tsx treated "watch" as the file argument
- **Fix:** Reordered to `tsx watch --env-file=.env src/index.ts`
- **Files modified:** `server/package.json`
- **Commit:** 09a9247

**2. [Rule 1 - Bug] CSS @import ordering warning**
- **Found during:** Task 3 build verification (first build pass)
- **Issue:** Google Fonts `@import url(...)` appeared after `@import 'tailwindcss'` which expands to layer declarations, violating CSS @import ordering rules
- **Fix:** Moved Google Fonts imports before `@import 'tailwindcss'` with explanatory comment
- **Files modified:** `client/src/styles/index.css`
- **Commit:** 9eed29d

## Manual Steps Required

The following cannot be automated and require human action before Plan 02:

1. **Link Supabase project:** `cd supabase && supabase link --project-ref YOUR_PROJECT_REF`
2. **Push migrations:** `supabase db push`
3. **Register Custom Access Token Hook:** Supabase Dashboard > Authentication > Hooks > Enable `custom_access_token_hook` on "Custom Access Token" event
4. **Fill client/.env.local:** Replace `YOUR_PROJECT.supabase.co` and `YOUR_ANON_KEY` with real values from Project Settings > API
5. **Fill server/.env:** Replace placeholder values with real Supabase service role key and anon key

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `students: unknown[]` on CachedRoster | `client/src/lib/db.ts` line 33 | Roster shape defined in Plan 02 when /sessions/today API is built |
| Empty state "Loading classes..." | `client/src/screens/ClassList.tsx` | Real class cards wired in Plan 02 |
| Placeholder icons (solid purple 192x512) | `client/public/icon-192.png`, `icon-512.png` | Final icons designed separately; placeholders satisfy PWA install requirement |

## Threat Flags

None — no new network endpoints or auth paths beyond those planned. The `GET /health/authed` endpoint is JWT-gated. RLS prevents cross-tenant data access server-side. The Custom Access Token Hook reads only from `public.staff` (no user-writable path).

## Self-Check: PASSED

Files verified present:
- supabase/migrations/20260521_001_schema.sql: FOUND
- supabase/migrations/20260521_002_rls.sql: FOUND
- supabase/migrations/20260521_003_auth_hook.sql: FOUND
- supabase/migrations/20260521_004_seed.sql: FOUND
- server/src/index.ts: FOUND
- server/src/plugins/auth.ts: FOUND
- client/src/screens/Login.tsx: FOUND
- client/src/screens/ClassList.tsx: FOUND
- client/src/App.tsx: FOUND
- client/public/manifest.webmanifest: FOUND

Commits verified:
- bde042b (Task 1): FOUND
- 09a9247 (Task 2): FOUND
- 9eed29d (Task 3): FOUND
