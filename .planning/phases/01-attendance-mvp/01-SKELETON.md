# Walking Skeleton: LSODance Attendance MVP

**Phase:** 01-attendance-mvp
**Created:** 2026-05-21
**Status:** Planned

---

## What the Skeleton Is

The thinnest possible end-to-end working slice. After Plan 01 completes, a real iPad user can open the app, log in with their email and password, see the app shell, and the system writes a test attendance record to real Supabase Postgres — all on live infrastructure. Nothing is mocked.

---

## Architectural Decisions

These decisions govern the entire platform. Every subsequent phase inherits them. They are locked.

### Directory Layout

```
/
├── server/                    # Fastify API (Node.js)
│   ├── src/
│   │   ├── index.ts           # Server entry — registers plugins, starts listening
│   │   ├── plugins/
│   │   │   ├── supabase.ts    # Supabase client plugin (service role)
│   │   │   ├── auth.ts        # JWT preHandler hook (extracts role + org_id)
│   │   │   └── cors.ts        # CORS + Helmet config
│   │   ├── routes/
│   │   │   ├── health.ts      # GET /health — liveness probe
│   │   │   ├── sessions.ts    # GET /sessions/today, POST /sessions/:id/submit
│   │   │   ├── attendance.ts  # GET /sessions/:id/roster, PATCH /attendance/:id
│   │   │   └── rfid.ts        # POST /rfid/checkin (stub, returns 501)
│   │   └── types/
│   │       └── index.ts       # TypeBox schemas + TS type augmentations
│   ├── tsconfig.json
│   └── package.json
│
├── client/                    # Vite + React + TypeScript + Tailwind v4 PWA
│   ├── src/
│   │   ├── main.tsx           # React entry — QueryClientProvider, Supabase auth state
│   │   ├── App.tsx            # Auth gate: routes to Login or main shell
│   │   ├── lib/
│   │   │   ├── supabase.ts    # Supabase anon client (singleton)
│   │   │   ├── db.ts          # Dexie schema — attendance_queue + cached_rosters
│   │   │   └── sync.ts        # Queue drain — online event + visibilitychange
│   │   ├── hooks/
│   │   │   ├── useAuth.ts     # Session state, login, logout
│   │   │   └── useSync.ts     # Registers online/visibilitychange listeners
│   │   ├── screens/
│   │   │   ├── Login.tsx      # Email + password login form
│   │   │   ├── ClassList.tsx  # Today's classes home screen
│   │   │   ├── Roster.tsx     # Per-class attendance marking screen
│   │   │   └── Success.tsx    # Post-submit confirmation (checkmark + timestamp)
│   │   ├── components/
│   │   │   ├── ClassCard.tsx  # Class tile with status badge
│   │   │   ├── StudentRow.tsx # 56px+ tap target row with status buttons
│   │   │   ├── ConfirmModal.tsx   # Radix Dialog — counts before submit
│   │   │   └── OfflineBanner.tsx  # "N records pending sync" indicator
│   │   └── styles/
│   │       └── index.css      # @import "tailwindcss"; @theme { ... design tokens ... }
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── vite.config.ts
│   └── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 20260521_001_schema.sql   # Full schema (all tables, enums, indexes)
│   │   ├── 20260521_002_rls.sql      # RLS enable + tenant isolation policies
│   │   ├── 20260521_003_auth_hook.sql # Custom Access Token Hook function
│   │   └── 20260521_004_seed.sql     # Seed: org, staff, classes, students, sessions
│   └── config.toml
│
├── SCHEMA.sql                 # Master schema reference (source of truth)
├── DOMAIN_MODEL.md            # Entity relationships
└── CLAUDE.md                  # Project instructions
```

### Framework

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Vite + React + TypeScript | 8.0.14 / 19.2.6 / 5.x |
| Styling | Tailwind CSS v4 | 4.3.0 |
| PWA | vite-plugin-pwa (Workbox) | 1.3.0 |
| Backend | Fastify | 5.8.5 |
| Database | Supabase Postgres | managed |
| Auth | Supabase Auth | JWT with Custom Access Token Hook |
| Offline queue | Dexie.js | 4.4.2 |
| Server state | TanStack Query | 5.100.11 |
| Client state | Zustand | 5.0.13 |

### Database

**Supabase Postgres** (managed). Schema in `supabase/migrations/`. Applied with `supabase db push`.

**Multi-tenancy:** `organization_id uuid NOT NULL` on every table. Never omit this column.

**RLS:** Enabled and forced on every table from day one. Policies use `(SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` (subselect caches result — no per-row calls).

**Roles:** Stored in `app_metadata` (server-writable only), injected by the Custom Access Token Hook Postgres function. Never `user_metadata`.

### Auth

**Supabase Auth** with email/password. Session stored in `localStorage`. Refreshed automatically by the Supabase JS client on every mount via `supabase.auth.getSession()`.

**Custom Access Token Hook** injects `role` and `organization_id` from the `staff` table into `app_metadata` at JWT mint time. This is the only secure pattern — `user_metadata` is user-writable.

**Fastify middleware** extracts `organizationId` and `role` from every JWT on every request. Never trusts the client body for these values.

### Offline Strategy

**IndexedDB (Dexie)** is the source of truth during offline periods.

- Attendance marks: written to `attendance_queue` first (optimistic), synced to Fastify API when online
- Roster data: written to `cached_rosters` at login time; served from IndexedDB when offline
- **No Background Sync API** — iOS Safari does not support it. Use `window.addEventListener('online', drain)` and `document.addEventListener('visibilitychange', drain)` exclusively
- Every queued operation carries a `clientId` (UUID stamped at write time) sent as `X-Idempotency-Key`. Server deduplicates.
- `createdAt` stamped at write time (not sync time). Queue drains in chronological order.

### Deployment

| Service | Purpose | Tier |
|---------|---------|------|
| Vercel | Frontend (Vite SPA) | Free |
| Railway | Fastify API | Starter |
| Supabase | Postgres + Auth + Realtime | Free (Pro for prod) |

### Design System

- Body font: **Atkinson Hyperlegible** (non-negotiable for accessibility)
- Display font: **DM Serif Display** (headings, dates)
- Brand: `--color-purple: #8f2db5`
- Min tap target: **56px** on every interactive element Mrs. Goodman touches
- Body text: **18px** minimum
- Source of truth: `tokens.css` (repo root) — translated to Tailwind `@theme {}` in `client/src/styles/index.css`

---

## The One Real DB Read/Write in This Skeleton

**Login → JWT → Fastify health check with auth → IndexedDB write**

1. User submits email + password to Supabase Auth
2. Supabase issues JWT with `role` and `organization_id` in `app_metadata` (via Custom Access Token Hook)
3. Frontend calls `GET /health` with `Authorization: Bearer <token>`
4. Fastify verifies JWT, returns `{ status: "ok", role, organizationId }`
5. Frontend writes a canary record to IndexedDB `cached_rosters` to prove offline storage works
6. UI displays the ClassList screen shell (empty state acceptable — real data in Plan 02)

This proves every layer is wired: Auth → JWT → Fastify middleware → Supabase client → IndexedDB.

---

## Decisions That Are NOT Made Here

These are delegated to later plans or phases:

- Stripe billing setup — Phase 3
- Resend/Twilio credentials — Phase 4
- Admin dashboard — Phase 5
- Multi-studio org switching — v2
