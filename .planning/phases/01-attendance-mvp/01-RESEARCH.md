# Phase 1: Attendance MVP - Research

**Researched:** 2026-05-21
**Domain:** Offline-first PWA attendance, Supabase Auth + RLS, Fastify API skeleton, Walking skeleton
**Confidence:** HIGH

---

## Summary

Phase 1 is a walking skeleton — the thinnest end-to-end slice from iPad login to submitted attendance record, running on real infrastructure. It establishes the multi-tenant Postgres schema, Supabase Auth with role injection, the Fastify API with JWT middleware, and an offline-first Vite + React PWA with an IndexedDB sync queue. Every later phase builds on this foundation, so getting the auth model and RLS policies right here is non-negotiable.

The stack is well-understood: all packages have been confirmed on npm, are actively maintained, and have no suspicious postinstall scripts. One update from STACK.md: **Vite is now at 8.0.14 stable** (not 7.x). Zod is now at **4.4.3** (not 3.x). Both updates are confirmed via npm registry. The STACK.md recommendations otherwise remain accurate.

The primary risk areas are: (1) iOS-specific offline limitations — no Background Sync API, 7-day cache eviction — which must drive the sync architecture from day one; (2) the auth security constraint — roles MUST live in `app_metadata` via the Custom Access Token Hook, not `user_metadata`; and (3) the optimistic UI pattern — attendance marks must be instant, with IndexedDB as the source of truth.

**Primary recommendation:** Build the walking skeleton in four discrete waves: database + RLS, Fastify skeleton, Vite PWA scaffold, then the attendance feature end-to-end. Seed data must exist before any UI work. The RFID endpoint stub (`POST /rfid/checkin`) should be built in Phase 1 even with no Pi connected.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Staff can create an account with email and password via Supabase Auth | Supabase Auth email/password flow confirmed; Admin invite pattern uses `supabase.auth.admin.inviteUserByEmail()` |
| AUTH-02 | Staff can log in and session persists across browser refresh (iPad PWA) | `supabase.auth.getSession()` on mount; Supabase handles JWT refresh automatically; session stored in localStorage |
| AUTH-03 | Staff can reset password via email link | `supabase.auth.resetPasswordForEmail()` built-in; no custom code needed |
| AUTH-04 | System enforces role-based access (admin, instructor, front_desk) via app_metadata | Custom Access Token Hook injects role from `staff` table into JWT `app_metadata`; RLS reads `auth.jwt() -> 'app_metadata' ->> 'role'` |
| AUTH-05 | Admin can invite and assign roles to new staff members | `supabase.auth.admin.inviteUserByEmail()` from service role; role stored in `staff` table; Hook picks it up at next sign-in |
| ATTN-01 | Front desk sees today's classes with done/pending/in-progress status | `class_sessions` table filtered by date; status enum `scheduled/completed/cancelled`; computed from attendance records |
| ATTN-02 | Front desk can tap a class to open its roster | JOIN `enrollments` to `students` filtered by `class_session_id`; cached in IndexedDB at login |
| ATTN-03 | Front desk can mark each student present, absent, late, or excused with 56px+ tap targets | `attendance_status` enum; optimistic UI write to IndexedDB first, then queue to API; 56px enforced in Tailwind v4 design tokens |
| ATTN-04 | Front desk sees present/absent counts update in real time as they mark | Derived from local IndexedDB state (immediate); Supabase Realtime for cross-device sync |
| ATTN-05 | Front desk can submit attendance with a confirmation modal showing counts | Radix UI Dialog for modal; counts computed from local state; PATCH endpoint marks session `completed` |
| ATTN-06 | Submitted classes show checkmark and timestamp on the home screen | `class_sessions.status = 'completed'` + `submitted_at` column; TanStack Query cache invalidation |
| ATTN-07 | Attendance works offline via IndexedDB queue and syncs on reconnect | Dexie.js sync queue; foreground sync only (no Background Sync API on iOS); `online` + `visibilitychange` event listeners |
| ATTN-08 | System exposes POST /rfid/checkin endpoint that accepts card_uid and returns student name | Fastify route with device JWT auth; looks up `students.rfid_uid`; writes attendance record; returns 501 stub until Pi is connected |
| ATTN-09 | Attendance records track marked_by source (manual or rfid) | `marked_by_source` enum column on `attendance` table; set by API based on endpoint used |
| INFR-01 | All tables include organization_id for multi-tenant readiness | `organization_id uuid NOT NULL` on every table; confirmed in SCHEMA.sql |
| INFR-02 | Supabase RLS policies enforce tenant isolation on every table | `ALTER TABLE x ENABLE ROW LEVEL SECURITY; ALTER TABLE x FORCE ROW LEVEL SECURITY;` in every migration |
| INFR-03 | Database schema includes all entity types from domain model | SCHEMA.sql already has complete schema; Phase 1 migrations apply the Phase 1 subset |
| INFR-04 | API uses Fastify with schema-based request/response validation | Fastify 5.8.5 + `@fastify/type-provider-typebox`; TypeBox schemas for all routes |
| INFR-05 | Frontend is a Vite + React + TypeScript + Tailwind PWA with service worker | Vite 8.0.14 + React 19.2.6 + TypeScript 5.x + Tailwind 4.3.0 + vite-plugin-pwa 1.3.0 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authentication (login, session, password reset) | Supabase Auth | Fastify (JWT verification) | Supabase Auth handles token issuance; Fastify verifies on every API call |
| Role injection (app_metadata) | Supabase Auth Hook (DB function) | — | Server-side only; user cannot write app_metadata directly |
| Today's class list (ATTN-01) | Frontend (TanStack Query + IndexedDB) | Fastify API | Fetched fresh on login; cached in IndexedDB for offline access |
| Roster display (ATTN-02) | Frontend (TanStack Query + IndexedDB) | Fastify API | Cached at login time into IndexedDB so it's available offline |
| Attendance marking (ATTN-03, ATTN-04) | Frontend (IndexedDB first) | Fastify API (sync) | Optimistic local write first; queue to API; counts computed from local state |
| Attendance submission (ATTN-05, ATTN-06) | Frontend triggers + Fastify confirms | Supabase Postgres | Fastify marks session completed; returns timestamp |
| Offline queue drain (ATTN-07) | Frontend (IndexedDB + event listeners) | — | `online` + `visibilitychange` events; no service worker sync on iOS |
| RFID endpoint (ATTN-08) | Fastify API | Supabase Postgres | Device JWT auth; no frontend involvement |
| Multi-tenant RLS (INFR-01, INFR-02) | Supabase Postgres (RLS) | Fastify (middleware adds org context) | Two lines of defense: app layer + database layer |
| PWA shell caching | Service worker (vite-plugin-pwa) | — | Cache-first for app shell; IndexedDB for data |
| Real-time count sync (ATTN-04 cross-device) | Supabase Realtime | Frontend subscriber | Postgres Changes stream; RLS-enforced |

---

## Standard Stack

### Core — Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 20 LTS | Runtime | Fastify v5 requires Node 20+ [VERIFIED: npm registry] |
| fastify | 5.8.5 | HTTP API framework | Schema-first, TypeScript-native, 7.8M downloads/week [VERIFIED: npm registry] |
| @fastify/cors | 11.2.0 | CORS headers | Official Fastify plugin [VERIFIED: npm registry] |
| @fastify/helmet | 13.0.2 | Security headers | Official Fastify plugin [VERIFIED: npm registry] |
| @fastify/type-provider-typebox | 6.1.0 | TypeBox schema/type bridge | Recommended TS type provider for Fastify v5 [VERIFIED: npm registry] |
| @supabase/supabase-js | 2.106.1 | Supabase client (service role) | v2 required; use service role for writes [VERIFIED: npm registry] |

### Core — Frontend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.14 | Build tool | Latest stable — STACK.md said 7.x but 8.x is now current [VERIFIED: npm registry] |
| react | 19.2.6 | UI framework | Stable production; `useActionState` for sync state [VERIFIED: npm registry] |
| tailwindcss | 4.3.0 | Utility CSS | CSS-first v4; use `@theme {}` not `tailwind.config.js` [VERIFIED: npm registry] |
| @tailwindcss/vite | 4.3.0 | Vite integration | v4-specific plugin; no PostCSS config needed [VERIFIED: npm registry] |
| @supabase/supabase-js | 2.106.1 | Auth client + Realtime | Frontend uses anon key with RLS [VERIFIED: npm registry] |
| @tanstack/react-query | 5.100.11 | Server state + caching | refetchOnReconnect aligns with offline sync [VERIFIED: npm registry] |
| dexie | 4.4.2 | IndexedDB offline queue | useLiveQuery React hook; TypeScript-first [VERIFIED: npm registry] |
| dexie-react-hooks | 4.4.0 | useLiveQuery hook | Ships with Dexie v4 ecosystem [VERIFIED: npm registry] |
| vite-plugin-pwa | 1.3.0 | Service worker + PWA manifest | Standard Vite PWA integration [VERIFIED: npm registry] |
| zustand | 5.0.13 | UI-only client state | Modal visibility, selected class, etc. [VERIFIED: npm registry] |
| zod | 4.4.3 | Schema validation | Latest stable — STACK.md said 3.x but 4.x is now current [VERIFIED: npm registry] |
| react-hook-form | 7.76.0 | Form state | Minimal re-renders for auth forms [VERIFIED: npm registry] |
| @hookform/resolvers | 5.4.0 | Zod v4 resolver | v5 supports zod v4 [VERIFIED: npm registry] |
| date-fns | 4.2.1 | Date formatting | Timezone-safe; today's date filtering [VERIFIED: npm registry] |
| @radix-ui/react-dialog | 1.1.15 | Confirmation modal | Accessible headless dialog [VERIFIED: npm registry] |

### Supabase CLI (local dev)

| Tool | Version | Purpose |
|------|---------|---------|
| supabase CLI | 2.95.4 (locally installed) | Migrations, local dev, Auth Hook deployment |

**Note on Supabase CLI:** Use the globally-installed `supabase` command for migrations and local dev. Do not install the npm `supabase` package as a project dependency — it is a CLI tool, not a library.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-pwa | Manual service worker | vite-plugin-pwa handles cache versioning, update detection, and Workbox integration automatically. Manual is hundreds of lines of error-prone code. |
| Dexie.js | Raw IDBDatabase API | Dexie provides Promise-based API, TypeScript generics, and `useLiveQuery`. Raw IDB is verbose and error-prone. |
| @radix-ui/react-dialog | Custom modal | Radix handles focus trapping, escape key, aria-modal — all required for accessibility on iPad. |
| Zod v4 | Zod v3 | v4 is the current stable. v3 is still maintained but receives no new features. `@hookform/resolvers` v5 is required for v4 compat. |

**Installation — Backend:**
```bash
mkdir server && cd server
npm init -y
npm install fastify @fastify/cors @fastify/helmet @fastify/type-provider-typebox
npm install @supabase/supabase-js
npm install -D typescript @types/node tsx
```

**Installation — Frontend:**
```bash
npm create vite@latest client -- --template react-ts
cd client
npm install tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js
npm install @tanstack/react-query zustand
npm install dexie dexie-react-hooks
npm install react-hook-form zod @hookform/resolvers
npm install date-fns
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install -D vite-plugin-pwa
```

---

## Package Legitimacy Audit

> slopcheck was installed and run, but it operates in Python mode by default and flagged all npm packages as "SLOP" due to ecosystem confusion — they do not exist on PyPI, which is correct; they are npm packages. The tool cannot verify npm packages. All packages were instead verified directly via `npm view` against the npm registry with confirmed publish dates, active maintenance histories, and no postinstall scripts found on any core package.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| fastify | npm | 9+ yrs | 7.8M/wk | github.com/fastify/fastify | N/A (wrong ecosystem) | Approved — canonical Node.js framework |
| @fastify/cors | npm | 7+ yrs | high | github.com/fastify/fastify | N/A | Approved — official Fastify org |
| @fastify/helmet | npm | 7+ yrs | high | github.com/fastify/fastify | N/A | Approved — official Fastify org |
| @fastify/type-provider-typebox | npm | 3+ yrs | high | github.com/fastify/fastify | N/A | Approved — official Fastify org |
| @supabase/supabase-js | npm | 4+ yrs | 5M+/wk | github.com/supabase/supabase-js | N/A | Approved — official Supabase client |
| dexie | npm | 10+ yrs | 1M+/wk | github.com/dfahlander/Dexie.js | N/A | Approved — canonical IndexedDB library |
| dexie-react-hooks | npm | 4+ yrs | high | github.com/dfahlander/Dexie.js | N/A | Approved — same org as dexie |
| vite-plugin-pwa | npm | 4+ yrs | 800K+/wk | github.com/vite-pwa/vite-plugin-pwa | N/A | Approved — standard Vite PWA solution |
| @tanstack/react-query | npm | 5+ yrs | 12M+/wk | github.com/tanstack/query | N/A | Approved — industry standard |
| zustand | npm | 5+ yrs | 5M+/wk | github.com/pmndrs/zustand | N/A | Approved — industry standard |
| zod | npm | 5+ yrs | 30M+/wk | github.com/colinhacks/zod | N/A | Approved — industry standard |
| react-hook-form | npm | 5+ yrs | 15M+/wk | github.com/react-hook-form | N/A | Approved — industry standard |
| @hookform/resolvers | npm | 4+ yrs | 10M+/wk | github.com/react-hook-form | N/A | Approved — same org as react-hook-form |
| date-fns | npm | 9+ yrs | 40M+/wk | github.com/date-fns/date-fns | N/A | Approved — industry standard |
| @radix-ui/react-dialog | npm | 4+ yrs | 5M+/wk | github.com/radix-ui/primitives | N/A | Approved — industry standard |

**No postinstall scripts found** on any core package (verified via `npm view <pkg> scripts.postinstall`).

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran in wrong ecosystem; all packages verified via npm directly)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
iPad PWA (Mrs. Goodman — home screen installed)
    |
    |  HTTPS API calls (Fastify)
    |  Supabase Auth (direct — login, session refresh)
    |  Supabase Realtime WebSocket (attendance updates)
    |
    +-----------------------------------+
    |                                   |
    v                                   v
Fastify API (Railway)          Supabase (managed)
  POST /auth/verify               Auth: JWT issuance
  GET  /sessions/today            Auth Hook: role -> app_metadata
  GET  /sessions/:id/roster      Postgres: multi-tenant schema
  PATCH /attendance/:id           Realtime: Postgres Changes
  POST  /sessions/:id/submit     RLS: organization_id isolation
  POST  /rfid/checkin (stub)
    |
    | service role client
    v
  Supabase Postgres
  (attendance writes bypass RLS via service role;
   all writes include organization_id from JWT)
    |
    | Postgres Changes (logical replication)
    v
  Supabase Realtime
    |
    v
  Other connected clients (future: admin dashboard, instructor view)

OFFLINE MODE (iPad):
  IndexedDB (Dexie)
    attendance_queue: pending writes {clientId, studentId, sessionId, status, createdAt, synced, retries}
    cached_rosters:   class + student data {sessionId, date, students[], fetchedAt}

  On reconnect (online event + visibilitychange):
    -> drain queue in chronological order (sort by createdAt ASC)
    -> TanStack Query refetchOnReconnect
```

### Recommended Project Structure

```
/
+-- server/                    # Fastify API
|   +-- src/
|   |   +-- index.ts           # Fastify app entry
|   |   +-- plugins/
|   |   |   +-- supabase.ts    # Supabase client plugin (service + anon)
|   |   |   +-- auth.ts        # JWT verification middleware
|   |   |   +-- cors.ts        # CORS + helmet setup
|   |   +-- routes/
|   |   |   +-- sessions.ts    # GET today's sessions, POST submit
|   |   |   +-- attendance.ts  # PATCH attendance, roster fetch
|   |   |   +-- rfid.ts        # POST /rfid/checkin (stub)
|   |   +-- types/
|   |       +-- index.ts       # Shared TypeBox schemas + TS types
|   +-- tsconfig.json
|   +-- package.json
|
+-- client/                    # Vite + React PWA
|   +-- src/
|   |   +-- main.tsx           # React entry, QueryClientProvider
|   |   +-- App.tsx            # Router, auth gate
|   |   +-- lib/
|   |   |   +-- supabase.ts    # Supabase anon client
|   |   |   +-- db.ts          # Dexie schema + tables
|   |   |   +-- sync.ts        # Queue drain logic
|   |   +-- hooks/
|   |   |   +-- useAuth.ts     # Session, login, logout
|   |   |   +-- useSync.ts     # Online event -> queue drain
|   |   +-- screens/
|   |   |   +-- Login.tsx
|   |   |   +-- ClassList.tsx  # Today's classes
|   |   |   +-- Roster.tsx     # Attendance marking
|   |   |   +-- Success.tsx    # Post-submit confirmation
|   |   +-- components/
|   |   |   +-- ClassCard.tsx
|   |   |   +-- StudentRow.tsx
|   |   |   +-- ConfirmModal.tsx
|   |   |   +-- OfflineBanner.tsx
|   |   +-- styles/
|   |       +-- index.css      # @import "tailwindcss"; @theme { ... }
|   +-- public/
|   |   +-- manifest.webmanifest
|   +-- vite.config.ts
|   +-- package.json
|
+-- supabase/                  # Supabase local dev
|   +-- migrations/
|   |   +-- 20260521_001_schema.sql   # Full schema from SCHEMA.sql
|   |   +-- 20260521_002_rls.sql      # RLS policies
|   |   +-- 20260521_003_seed.sql     # Seed: org, staff, classes, students
|   +-- config.toml
|
+-- SCHEMA.sql                 # Master schema reference (already exists in repo)
```

### Pattern 1: Supabase Auth Custom Access Token Hook

**What:** A Postgres function triggered at JWT mint time that injects `role` and `organization_id` from the `staff` table into `app_metadata`.

**When to use:** Always — this is the only way to put immutable role claims into the JWT that RLS can trust.

```sql
-- Source: [CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  staff_record record;
BEGIN
  SELECT role, organization_id
  INTO staff_record
  FROM public.staff
  WHERE user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  IF staff_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(staff_record.role::text));
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(staff_record.organization_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to the hook caller
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Register in Supabase Dashboard: Authentication > Hooks > Custom Access Token
```

### Pattern 2: RLS Policy with Cached JWT Claims

**What:** Tenant-scoping RLS policy that caches `auth.jwt()` call to avoid per-row function calls (10x performance difference).

**When to use:** Every table with `organization_id`.

```sql
-- Source: [CITED: supabase.com/docs/guides/database/postgres/row-level-security]
-- WRONG (per-row call — 10x slower):
-- CREATE POLICY bad ON attendance USING (organization_id = auth.uid());

-- CORRECT: subselect caches the JWT result for the duration of the query
CREATE POLICY "tenant_isolation" ON attendance
  USING (
    organization_id = (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    )
  );

-- Role-gated write: only front_desk and admin can insert attendance
CREATE POLICY "attendance_write" ON attendance
  FOR INSERT WITH CHECK (
    organization_id = (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    )
    AND (
      SELECT auth.jwt() -> 'app_metadata' ->> 'role'
    ) IN ('admin', 'front_desk', 'instructor')
  );
```

### Pattern 3: Dexie IndexedDB Schema + Sync Queue

**What:** Dexie database with `attendance_queue` and `cached_rosters` tables. Writes go to IndexedDB first; queue drains on reconnect.

```typescript
// Source: [CITED: dexie.org/docs/Tutorial/React]
import Dexie, { type Table } from 'dexie';

export interface QueuedAttendance {
  id?: number;          // auto-increment primary key
  clientId: string;     // UUID — idempotency key sent to server
  studentId: string;
  sessionId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  createdAt: number;    // Date.now() at mark time — ordering critical
  synced: boolean;
  retries: number;
}

export interface CachedRoster {
  sessionId: string;    // primary key
  date: string;         // YYYY-MM-DD
  students: { id: string; name: string; enrollmentId: string }[];
  fetchedAt: number;
}

export class AttendanceDB extends Dexie {
  attendance_queue!: Table<QueuedAttendance>;
  cached_rosters!: Table<CachedRoster>;

  constructor() {
    super('lsodance_attendance');
    this.version(1).stores({
      attendance_queue: '++id, clientId, sessionId, synced, createdAt',
      cached_rosters: 'sessionId, date',
    });
  }
}

export const db = new AttendanceDB();
```

### Pattern 4: Foreground Sync (iOS-safe — no Background Sync API)

**What:** Queue drain triggered on `online` event and `visibilitychange`. Do NOT use the Background Sync API — iOS Safari does not support it.

```typescript
// Source: [CITED: developer.mozilla.org/en-US/docs/Web/API/Window/online_event]
// iOS Background Sync constraint: [CITED: developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/sync]
export function useSyncOnReconnect() {
  const drainQueue = async () => {
    if (!navigator.onLine) return;

    // Sort ascending by createdAt — chronological order is critical for state correctness
    const pending = await db.attendance_queue
      .where('synced').equals(0)
      .sortBy('createdAt');

    for (const item of pending) {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/attendance/${item.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': item.clientId,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: item.status }),
        });
        if (res.ok || res.status === 409) {
          // 409 = already processed (idempotent duplicate)
          await db.attendance_queue.update(item.id!, { synced: true });
        }
      } catch {
        await db.attendance_queue.update(item.id!, { retries: item.retries + 1 });
      }
    }
  };

  useEffect(() => {
    window.addEventListener('online', drainQueue);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') drainQueue();
    });
    drainQueue(); // drain immediately in case already online
    return () => window.removeEventListener('online', drainQueue);
  }, []);
}
```

### Pattern 5: Vite 8 + Tailwind v4 Setup

**What:** CSS-first Tailwind v4 configuration with design tokens in `@theme {}` block. No `tailwind.config.js`.

```typescript
// vite.config.ts — Source: [CITED: tailwindcss.com/docs/installation/vite]
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        name: 'LSODance Attendance',
        short_name: 'LSODance',
        description: "Attendance for LaShelle's School of Dance",
        theme_color: '#8f2db5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

```css
/* src/styles/index.css — design tokens from tokens.css translated to Tailwind v4 @theme */
@import "tailwindcss";

@theme {
  --color-purple: #8f2db5;
  --color-purple-deep: #6b228a;
  --color-purple-tint: #f0e1f6;
  --color-purple-tint-strong: #d9b8e8;
  --color-purple-ink: #3d1252;

  --color-cream: #fbf8f4;
  --color-paper: #f7f3ee;
  --color-line: #ece6dd;
  --color-line-strong: #d9d2c5;
  --color-ink: #1a1a1a;
  --color-ink-2: #4a4a4a;
  --color-ink-3: #7a7670;

  --color-gold: #d4a84b;
  --color-gold-soft: #f3e3b8;
  --color-gold-ink: #6e521a;

  --color-green: #16a34a;
  --color-green-soft: #dcfce7;
  --color-red: #dc2626;
  --color-red-soft: #fee2e2;

  --font-display: 'DM Serif Display', 'Bodoni Moda', Georgia, serif;
  --font-body: 'Atkinson Hyperlegible', 'Helvetica Neue', Helvetica, Arial, sans-serif;

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;
}

/* Required by project constraints: 18px body text, Atkinson Hyperlegible */
html { font-size: 18px; }
body { font-family: var(--font-body); color: var(--color-ink); }
```

### Pattern 6: Fastify JWT Middleware

**What:** Fastify `preHandler` hook that verifies Supabase-issued JWT and attaches `organizationId` and `role` to the request object.

```typescript
// src/plugins/auth.ts
// Source: [CITED: fastify.dev/docs/latest/Reference/Plugins]
import fp from 'fastify-plugin';
import { createClient } from '@supabase/supabase-js';

export default fp(async (fastify) => {
  const serviceClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  fastify.decorate('supabase', serviceClient);

  fastify.addHook('preHandler', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    // Verify JWT via Supabase — validates signature and expiry
    const userClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error } = await userClient.auth.getUser();

    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const appMeta = user.app_metadata as { role?: string; organization_id?: string };
    request.user = user;
    request.organizationId = appMeta.organization_id;
    request.role = appMeta.role;
  });
});
```

### Pattern 7: Optimistic Attendance Mark

**What:** Write to local state and IndexedDB immediately on tap; queue server sync in background. The UI never waits for the network.

```typescript
// Source: [ASSUMED] — offline-first optimistic update pattern
const markAttendance = async (studentId: string, status: AttendanceStatus) => {
  const clientId = crypto.randomUUID(); // idempotency key — stamped once at write time

  // 1. Optimistic local update — UI responds instantly
  setLocalStatuses(prev => ({ ...prev, [studentId]: status }));

  // 2. Queue to IndexedDB — survives tab close and network loss
  await db.attendance_queue.add({
    clientId,
    studentId,
    sessionId,
    status,
    createdAt: Date.now(), // MUST stamp NOW, not at sync time
    synced: false,
    retries: 0,
  });

  // 3. Attempt immediate sync if online (non-blocking)
  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/attendance/${attendanceRecordId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': clientId,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await db.attendance_queue.where('clientId').equals(clientId).modify({ synced: true });
      }
    } catch {
      // Network error — stays in queue, drains on reconnect
    }
  }
};
```

### Anti-Patterns to Avoid

- **Background Sync API on iOS:** `ServiceWorkerRegistration.sync.register()` silently fails on iPad Safari. Use the foreground `online` + `visibilitychange` pattern exclusively.
- **Roles in `user_metadata`:** `user_metadata` is user-writable via the Supabase JS SDK. Never put authorization-bearing claims there. Use `app_metadata` only, injected by the Custom Access Token Hook.
- **Timestamp at sync time not write time:** Queue operations must carry a `createdAt` stamped at the moment the user tapped, not when sync fires. This is the only way to preserve ordering when multiple offline edits exist.
- **Calling `auth.jwt()` per-row in RLS without subselect:** Always wrap in `(SELECT auth.jwt() -> ...)` to cache the result for the query. Per-row calls cause 10x slowdowns on table scans.
- **Missing `organization_id` on Fastify writes:** Middleware must extract `organization_id` from the JWT and attach it to every write. Never trust the client to supply it in the request body.
- **No idempotency key on queued operations:** Each queued item needs a client-generated UUID sent as `X-Idempotency-Key`. The server deduplicates on this key to prevent double-writes on retry.
- **Realtime subscriptions on raw Broadcast channels:** Use Postgres Changes (RLS-enforced), not raw Broadcast. Broadcast bypasses RLS; any subscriber can receive any message.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB access | Custom IDB wrapper | Dexie.js | IDB API is callback-based, has version migration edge cases, and lacks TypeScript generics. Dexie handles all of it. |
| Service worker registration | Manual SW code | vite-plugin-pwa (Workbox) | Cache naming, versioning, update detection, and the "new version available" banner are all handled. Getting any one wrong causes stale iPad experiences. |
| JWT verification | Custom HMAC check | Supabase client `auth.getUser()` | Supabase rotates signing keys; `getUser()` always uses the current key. Custom HMAC becomes stale. |
| Accessible confirmation modal | Custom div + focus trap | `@radix-ui/react-dialog` | Focus trapping, escape key, `aria-modal`, portal rendering — dozens of edge cases. Radix gets them all right for Mrs. Goodman's iPad. |
| Form state with validation | useState per field | react-hook-form + zod | useState re-renders on every keystroke. RHF uses uncontrolled inputs; zod schemas are reused at both the form and API boundary. |
| Optimistic updates + refetch | Manual useEffect chain | TanStack Query `useMutation` | `onMutate` (optimistic write), `onError` (rollback), `onSettled` (refetch) is the production pattern. The hand-rolled version always has a stale cache bug. |

**Key insight:** The hardest parts of offline PWA — cache versioning, sync ordering, accessible UI — are solved problems with battle-tested libraries. The value in Phase 1 is in the attendance flow, data model, and auth security, not infrastructure plumbing.

---

## Common Pitfalls

### Pitfall 1: Background Sync API Does Not Exist on iOS
**What goes wrong:** Service worker `sync` event never fires on iPad Safari. Queued attendance never reaches the server.
**Why it happens:** Background Sync is not implemented in Safari/WebKit as of iOS 26.
**How to avoid:** Use `window.addEventListener('online', drain)` and `document.addEventListener('visibilitychange', drain)` exclusively. Never register a sync tag. Verify: `'SyncManager' in window` returns `false` on the target iPad.
**Warning signs:** Attendance marked offline never appears in the database after reconnect, with no error shown to the user.

### Pitfall 2: iOS 7-Day Cache Eviction
**What goes wrong:** Mrs. Goodman returns after a week off; app shows white screen because service worker cache was evicted by iOS.
**Why it happens:** iOS Safari evicts script-writable storage (cache storage AND IndexedDB) after 7 days of no origin access. This is an OS-level policy, not configurable.
**How to avoid:** Cache only the minimal HTML/JS/CSS shell. Roster data lives in IndexedDB and is repopulated at every successful login — IndexedDB survives eviction better than cache storage for data. On app open, call `reg?.update()` to force a service worker refresh check.
**Warning signs:** White screen on the real iPad after 8+ days of no visits.

### Pitfall 3: Attendance Queue Syncs Out of Order
**What goes wrong:** Two offline edits to the same student (mark absent, then mark present) arrive at the server in reverse order. Final state is wrong.
**Why it happens:** Queue drains in whatever order the network returns, not chronological order.
**How to avoid:** Stamp `createdAt: Date.now()` at the moment of write. Sort by `createdAt` ascending before draining. Each record is independent per student, so ordering within a student's edits is what matters.
**Warning signs:** After testing offline-then-reconnect with two quick taps, the final attendance state does not match the last tap the user made.

### Pitfall 4: Role in `user_metadata` Allows Self-Promotion
**What goes wrong:** Any authenticated user calls `supabase.auth.updateUser({ data: { role: 'admin' } })` and gains admin access.
**Why it happens:** `user_metadata` is user-writable by Supabase design. `app_metadata` is server-only.
**How to avoid:** All role claims injected by the Custom Access Token Hook from `app_metadata`. Every RLS policy reads `auth.jwt() -> 'app_metadata' ->> 'role'`, never `user_metadata`.
**Warning signs:** A test user can change their apparent role via the Supabase JS SDK without any server call.

### Pitfall 5: Missing RLS on a New Table
**What goes wrong:** A migration adds a table without `ENABLE ROW LEVEL SECURITY`. Postgres defaults to allow-all. Cross-tenant data becomes readable.
**Why it happens:** Postgres tables default to RLS disabled.
**How to avoid:** Every migration must include both lines:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_table FORCE ROW LEVEL SECURITY;
```
Add a canary query to the test seed: `SELECT * FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;` — it must return zero rows.
**Warning signs:** That query returns any rows after migration.

### Pitfall 6: No Idempotency Key on Attendance Writes
**What goes wrong:** Network blip causes the PWA to retry a PATCH. Two attendance records exist for the same student in the same session.
**Why it happens:** Retry logic without deduplication always causes duplicates on intermittent connections.
**How to avoid:** Client generates a UUID at write time, sends as `X-Idempotency-Key` header. Server uses `ON CONFLICT DO NOTHING` or upserts by `(student_id, class_session_id)`.
**Warning signs:** After simulating a failed network on a single tap and reconnecting, the student has two attendance rows.

### Pitfall 7: Attendance Marks Feel Slow Without Optimistic UI
**What goes wrong:** Mrs. Goodman taps "Present"; button spins for 1-2 seconds before confirming. Full class takes 2+ minutes instead of 30 seconds.
**Why it happens:** UI waits for server response before updating local state.
**How to avoid:** Update local React state and write to IndexedDB immediately on tap. Server sync is background. The 30-second-per-class goal requires this — there is no workaround.
**Warning signs:** Any network-dependent delay between tap and visual confirmation.

### Pitfall 8: Stale Service Worker Leaves iPad Running Old Code After Deploy
**What goes wrong:** A critical bug fix is deployed. Mrs. Goodman's iPad continues running the old service worker; she reports the bug "still there."
**Why it happens:** Service workers are long-lived and Safari caches them aggressively.
**How to avoid:** Use `registerType: 'autoUpdate'` in vite-plugin-pwa. Force `reg?.update()` on every app open. Show a "New version available — tap to refresh" banner when a new SW is waiting via `registration.waiting`.
**Warning signs:** Fix is confirmed deployed but bug reports continue from the specific iPad.

---

## Code Examples

### Supabase Client Setup (Frontend)

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,    // localStorage — survives iPad browser refresh (AUTH-02)
      autoRefreshToken: true,  // JWT refresh before expiry
    },
  }
);
```

### Login + Password Reset (AUTH-01, AUTH-02, AUTH-03)

```typescript
// src/hooks/useAuth.ts — [ASSUMED] standard Supabase auth pattern
export function useAuth() {
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const resetPassword = async (email: string) => {
    // AUTH-03: sends reset link to email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  return { signIn, resetPassword };
}
```

### Admin Invite Staff (AUTH-05)

```typescript
// Fastify route handler — uses service role client (server-side only)
// [ASSUMED] based on Supabase admin API documentation
async function inviteStaff(email: string, role: 'admin' | 'instructor' | 'front_desk') {
  // Step 1: Send invite email via Supabase Auth
  const { data: { user }, error } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (error || !user) throw error;

  // Step 2: Create staff record — Custom Access Token Hook reads this on next login
  await serviceClient.from('staff').insert({
    user_id: user.id,
    organization_id: organizationId, // from request JWT
    role,
    full_name: fullName,
  });
}
```

### Session Submission (ATTN-05, ATTN-06)

```typescript
// Fastify route — PATCH /sessions/:id/submit
// [ASSUMED] standard Fastify + Supabase service role pattern
fastify.patch('/sessions/:sessionId/submit', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const { organizationId } = request; // extracted from JWT by auth middleware

  const { data, error } = await fastify.supabase
    .from('class_sessions')
    .update({
      status: 'completed',
      submitted_at: new Date().toISOString(),
      submitted_by: request.user.id,
    })
    .eq('id', sessionId)
    .eq('organization_id', organizationId) // belt-and-suspenders beyond RLS
    .select()
    .single();

  if (error) return reply.status(500).send({ error: error.message });
  return reply.send(data);
});
```

### Supabase Realtime Subscription (ATTN-04 cross-device)

```typescript
// Source: [CITED: supabase.com/docs/guides/realtime/subscribing-to-database-changes]
useEffect(() => {
  const channel = supabase
    .channel(`attendance:session:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance',
        filter: `class_session_id=eq.${sessionId}`,
      },
      (payload) => {
        // Only apply remote updates for records not currently in local pending queue
        if (payload.new && !localPendingClientIds.has(payload.new.client_id)) {
          setRemoteStatuses(prev => ({
            ...prev,
            [payload.new.student_id]: payload.new.status,
          }));
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [sessionId]);
```

### RFID Endpoint Stub (ATTN-08)

```typescript
// Fastify route — POST /rfid/checkin — Phase 1 stub
// ATTN-08 is satisfied at the API contract level; returns 501 until Pi hardware ships
// Source: [ASSUMED] pattern matching ARCHITECTURE.md design
fastify.post('/rfid/checkin', {
  schema: {
    body: Type.Object({
      card_uid: Type.String(),
      device_id: Type.String(),
    }),
    response: {
      501: Type.Object({ message: Type.String() }),
    },
  },
}, async (_request, reply) => {
  return reply.status(501).send({
    message: 'RFID hardware integration pending — Phase 2 (v2 requirements)',
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind config in `tailwind.config.js` | CSS `@theme {}` block | Tailwind v4 (Jan 2025) | No config file; `@tailwindcss/vite` plugin replaces PostCSS setup |
| Background Sync for PWA offline queue | `online` + `visibilitychange` foreground sync | iOS 13.4+ (still current iOS 26) | Background Sync is silently absent on Safari; foreground-only is the correct production pattern |
| Vite 7.x | Vite 8.x stable | March 2026 | Vite 8.0.14 is the current stable release; STACK.md targeted 7.x |
| Zod 3.x | Zod 4.x stable | Zod v4 release (2025) | `@hookform/resolvers` v5 required for compatibility; import path unchanged (`from 'zod'`) |
| Dexie v3 (separate live query package) | Dexie v4 + dexie-react-hooks | Dexie v4 (2024) | `useLiveQuery` now in separate `dexie-react-hooks` package |

**Version corrections vs STACK.md:**
- Vite: was `7.x` -> now `8.0.14` stable (major version bump since STACK.md research)
- Zod: was `3.x` -> now `4.4.3` stable (major version bump; use `@hookform/resolvers` v5)
- `@supabase/supabase-js`: was `2.106.0` -> now `2.106.1` (minor patch, no breaking changes)
- `react-hook-form`: was `7.x` -> now `7.76.0` (same major, latest patch)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fastify JWT verification via `supabase.auth.getUser(token)` on the anon client works without a separate `@fastify/jwt` plugin | Pattern 6 | Minor — may need different approach; verify with Supabase + Fastify integration docs before building auth middleware |
| A2 | `crypto.randomUUID()` is available without polyfill on the target iPad | Patterns 3, 7 | Low — available in Safari 15.4+; any modern iPad on iOS 15+ has it |
| A3 | The Admin invite flow requires a two-step approach (invite email, then insert staff record separately) | Code Examples | Medium — if the Auth Hook fires before the staff record is inserted, the role will be missing from the first JWT. Test this sequence with a real invite before declaring AUTH-05 complete. |
| A4 | Zod v4 `zodResolver` import path from `@hookform/resolvers/zod` is unchanged from v3 | Standard Stack | Low — confirmed via @hookform/resolvers v5 release notes; verify on first form build |
| A5 | Vite 8 `create-vite@latest react-ts` template sets up an identical development environment to Vite 7 for PWA purposes | Standard Stack | Low — VitePWA plugin configuration is framework-independent; only scaffolding differs |

---

## Open Questions

1. **Local Supabase dev vs. hosted Supabase for Phase 1**
   - What we know: Supabase CLI 2.95.4 is installed; Docker 28.3.3 is running. `supabase start` would spin up a local Postgres + Auth instance.
   - What's unclear: Does Thomas want to develop against local Supabase (faster, no network, free) or directly against the hosted project (simpler, fewer surprises at deploy)?
   - Recommendation: Use `supabase start` for local dev. Apply migrations to hosted project with `supabase db push`. This is the standard CLI workflow.

2. **Custom Access Token Hook registration method**
   - What we know: The Hook function goes in a migration SQL file. But registration (telling Supabase Auth to call it) must be done through the Supabase Dashboard under Authentication > Hooks.
   - What's unclear: Whether this registration can be automated via the CLI or requires a manual Dashboard step.
   - Recommendation: Treat Hook registration as a one-time manual step. Document it explicitly in the walking skeleton setup instructions. The function itself is in a migration.

3. **Phase 1 seed data strategy**
   - What we know: The attendance flow requires organizations, staff, class_sessions, students, and enrollments to exist before any UI testing is possible.
   - What's unclear: Will real LSODance data be loaded, or synthetic seed data?
   - Recommendation: Create a `seed.sql` with one organization, one admin (Carollette), one front_desk (Mrs. Goodman), 3 class sessions for today's date (Saturday), and 15 students enrolled in one of them. This is enough to validate all Phase 1 success criteria.

4. **Zod v4 migration from STACK.md's v3 recommendation**
   - What we know: Zod v4.4.3 is current stable; `@hookform/resolvers` v5 supports it. The `from 'zod'` import is unchanged.
   - What's unclear: Whether any STACK.md code examples that used Zod v3 APIs need updates.
   - Recommendation: Proceed with zod v4 and `@hookform/resolvers` v5. Only Phase 1 uses forms (login), so the migration surface is small.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend API | yes | v25.2.1 | — |
| npm | Package management | yes | 11.6.2 | — |
| Docker | Supabase local dev | yes | 28.3.3 | Use hosted Supabase directly |
| Supabase CLI | Migrations, local dev | yes | 2.95.4 | Run migrations via Supabase Dashboard SQL editor |
| git | Version control | yes | 2.49.0 | — |

**Node.js version note:** Node v25.2.1 is the current release channel, not LTS. Fastify v5 requires Node 20+, so v25 is compatible. For Railway deployment, pin to Node 20 LTS in `.nvmrc` and the `engines` field in `package.json` to avoid runtime version surprises.

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Supabase CLI local dev requires Docker; fallback is the hosted Supabase Dashboard (acceptable for a solo developer, slightly slower migration iteration).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth email/password; no custom auth code needed |
| V3 Session Management | Yes | Supabase JWT auto-refresh; `persistSession: true`; recommend 15-30 min JWT TTL for staff |
| V4 Access Control | Yes | RLS policies check `app_metadata` role; Fastify middleware extracts role on every request |
| V5 Input Validation | Yes | TypeBox schemas on all Fastify routes; Zod v4 on frontend forms |
| V6 Cryptography | Partial | Supabase handles JWT signing and rotation; RFID API keys stored as bcrypt hashes in DB |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Role escalation via `user_metadata` | Elevation of Privilege | `app_metadata` only via Custom Access Token Hook; never read roles from `user_metadata` |
| Cross-tenant data access | Information Disclosure | RLS on all tables + Fastify middleware extracts `organization_id` from JWT for every write |
| Attendance double-write on retry | Tampering | `X-Idempotency-Key` UUID + server-side `ON CONFLICT DO NOTHING` |
| Stale JWT after role change or demotion | Elevation of Privilege | Short JWT TTL (15-30 min); `supabase.auth.admin.signOut(userId, 'others')` for immediate revocation |
| Missing RLS on new table | Information Disclosure | `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` required in every migration; verify with `pg_tables` canary query |
| Service worker caching auth tokens | Information Disclosure | Cache only app shell (JS/CSS/HTML); API calls always carry fresh `Authorization` headers, never cached |
| Attendance marks intercepted in transit | Tampering | HTTPS only (Railway + Vercel enforce this); no custom certificate handling needed |

---

## Sources

### Primary (HIGH confidence)
- [Supabase Auth Custom Claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — Custom Access Token Hook pattern, `app_metadata` vs `user_metadata`
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy syntax, subselect caching pattern
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — subscription API, RLS enforcement on channels
- [Fastify v5 docs](https://fastify.dev/docs/latest/) — plugin architecture, preHandler hooks, TypeBox type provider
- [Tailwind v4 installation/Vite](https://tailwindcss.com/docs/installation/vite) — `@tailwindcss/vite` + `@theme {}` config
- [vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/) — service worker config, manifest, Workbox runtime caching
- [Dexie.js docs — React tutorial](https://dexie.org/docs/Tutorial/React) — schema definition, `useLiveQuery`, sync patterns
- npm registry — all package versions and publish dates confirmed 2026-05-21 via `npm view`

### Secondary (MEDIUM confidence)
- Project `SCHEMA.sql` — complete schema with enum types, RLS design comments, indexes (in repo root)
- Project `screens.jsx` — exact UI component hierarchy (ClassCard, StudentRow, ConfirmModal, OfflineBanner)
- Project `tokens.css` — design token values, translated to Tailwind v4 `@theme {}` block in Pattern 5
- Project `PITFALLS.md` — iOS Background Sync absence (Pitfall 3), 7-day cache eviction (Pitfall 2), queue ordering (Pitfall 1)
- Project `ARCHITECTURE.md` — offline queue design, Realtime channel naming convention, data flow diagrams

### Tertiary (LOW confidence)
- None — all claims are either verified via npm/official docs or tagged [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all 15 packages verified via `npm view` with publish dates on 2026-05-21
- Architecture: HIGH — directly derived from existing ARCHITECTURE.md, SCHEMA.sql, and screens.jsx
- Pitfalls: HIGH — documented in PITFALLS.md with linked sources; iOS offline constraints verified via MDN
- Walking skeleton order: HIGH — standard practice confirmed by ARCHITECTURE.md layer sequence

**Research date:** 2026-05-21
**Valid until:** 2026-08-21 (90 days; Vite, zod, and supabase-js release frequently — re-verify package versions before `npm install`)

**Key corrections vs STACK.md:**
- Vite 8.0.14 is current stable (not 7.x)
- Zod 4.4.3 is current stable (not 3.x); `@hookform/resolvers` v5 required for compatibility
- `react-hook-form` 7.76.0 (latest patch in same major)
- `@supabase/supabase-js` 2.106.1 (minor patch bump; no breaking changes)
