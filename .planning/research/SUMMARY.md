# Project Research Summary

**Project:** LSODance Studio Platform
**Domain:** Dance studio management SaaS — single-location, 75-150 students
**Researched:** 2026-05-21
**Confidence:** HIGH

## Executive Summary

LSODance is a bespoke studio management platform for a 22-year established dance studio in Detroit. The right mental model is "boutique studio management SaaS, not a Mindbody clone" — the feature set is deliberately narrow, the UX must work for a 70+ year-old front desk employee on an iPad, and the architecture must be multi-tenant from day one even though it serves one studio today. Competitors like Jackrabbit Dance and DanceStudio-Pro provide the table stakes inventory; this platform wins on execution quality in two specific areas: sub-30-second attendance marking and offline-first reliability on spotty studio WiFi.

The recommended stack — Fastify 5 / React 19 / Supabase / Stripe — is well-validated and the right choice for this scale. The architecture is a clean three-tier PWA with an offline attendance queue backed by IndexedDB (Dexie.js), RLS-enforced multi-tenancy at the database layer, and Stripe handling the full subscription lifecycle via webhooks. The total production cost lands around $35-47/month, not zero — Railway's free tier was removed in 2024, and Supabase requires the $25/month Pro tier in production.

The highest-severity risks are correctness and security issues, not performance: iOS's Background Sync API does not exist (the offline queue must drain on foreground reconnect, not via background sync), Supabase roles stored in `raw_user_meta_data` are user-writable and create a trivial authorization bypass, and Stripe's webhook handler will timeout and generate duplicate notifications if it does synchronous work before returning 200. All three are Phase 1-2 decisions that cannot be retrofitted cheaply. Get them right before writing a line of attendance or billing code.

---

## Key Findings

### Recommended Stack

The stack is sound. Every major choice is the current community standard or the pragmatic winner at this scale. Three breaking-change gotchas need action before coding starts: Tailwind v4 eliminates `tailwind.config.js` entirely (use CSS `@theme {}`), Stripe Node v22 removes `total_count` expansion on list endpoints (use cursor pagination), and `@supabase/supabase-js` v2.79+ requires Node 20+ (Node 18 is EOL).

**Core technologies:**
- **Fastify 5 + TypeScript 5:** HTTP API server — 2-3x faster than Express, schema-first validation, first-class TS generics. Express is maintenance-mode; Fastify is the correct greenfield choice.
- **React 19 + Vite 7 + Tailwind 4:** Frontend — React 19's concurrent features matter for offline/sync UX; Vite 7 native ESM for sub-100ms HMR; Tailwind 4 production-ready as of Jan 2025.
- **Supabase (Postgres + Auth + Realtime + Storage):** Data layer — relational data requires SQL; RLS enforces multi-tenancy at the DB layer; Realtime via Postgres Changes (not Broadcast) respects RLS automatically.
- **Stripe Node 22.1.1:** Recurring billing — best subscription billing API; webhook-driven lifecycle maps cleanly to studio access control. Five subscription states, not two — design the state machine first.
- **Resend 6.12.3 + React Email:** Transactional email — 3K/month free permanently; React Email templates are typed components. SendGrid retired its free tier in May 2025.
- **Twilio 6.0.2:** SMS — ~$5-7/month at 150 students; A2P 10DLC registration is mandatory and takes 1-2 weeks for carrier approval. Budget this into the timeline.
- **Dexie 4 + vite-plugin-pwa:** Offline attendance queue — IndexedDB abstraction with `useLiveQuery` React hooks; service worker for PWA manifest and cache management.
- **TanStack Query v5 + Zustand 5:** State management — TanStack Query for all server state; Zustand for UI-only state; `refetchOnReconnect` pairs directly with the offline queue drain pattern.

**Production cost reality:** ~$35-47/month (Vercel $0 + Railway $5-15 + Supabase Pro $25 + Twilio $5-7). Railway has no free tier. Plan for this before launch.

See: `.planning/research/STACK.md`

---

### Expected Features

The dance studio management market has 10+ competitors covering every table-stakes feature. LSODance is not competing on feature breadth — it is competing on execution quality for a specific user (Mrs. Goodman, iPad, spotty WiFi) and a specific differentiator (sub-30-second attendance).

**Must have (table stakes) — users leave for a competitor that has these:**
- Student/family CRUD with multi-child family accounts
- Weekly recurring class scheduling with visual calendar
- Roster-based attendance (present/absent/late/excused)
- Online enrollment with waitlist management
- Recurring tuition billing with autopay (Stripe subscriptions)
- Failed payment recovery — automated dunning (retry + SMS/email alert)
- Parent portal — class view, invoice view, online payment, contact update
- Invoices and payment history (per-family ledger)
- Transactional email (enrollment confirmations, payment receipts, absence alerts)
- Role-based staff access (admin, instructor, front desk — three roles covers the market)
- Basic financial reporting (5-8 pre-built views, not 200+ custom reports)

**Should have (differentiators this platform is positioned to win):**
- Sub-30-second attendance flow — large tap targets (56px+), 18px+ text, minimal screens. No competitor has solved this specifically. This is the core value.
- Offline-first attendance — IndexedDB queue + sync on reconnect. Rare in this market.
- Accessibility-first design — Atkinson Hyperlegible, high-contrast, built for Mrs. Goodman. Genuine competitive advantage for studios with similar staff demographics.
- SMS absence alerts and announcements (Twilio) — most platforms do email only.
- RFID check-in endpoint — Pi-based automated attendance. Rare in dance studio software.
- Recital and event management — act lineup, running order, volunteer assignments.
- Costume tracking with size management — measurements, assignments, order tracking.

**Deliberately excluded (anti-features):**
- Consumer marketplace / discovery (requires network effects that don't exist)
- Native iOS/Android app (PWA to home screen covers the use case)
- QuickBooks integration (Stripe dashboard handles financials at this scale)
- AI email generation (gimmick for a studio owner who knows her community)
- Lead CRM / prospect pipeline (22-year established studio doesn't need a sales funnel)
- Real-time chat (email + SMS reach parents where they are)
- Complex reporting suite (5-8 pre-built views; 200 configurable reports is bloat)

**Defer until validated with Carollette:**
- Student skill/progress tracking (not confirmed as a priority)
- Makeup class scheduling (validate need before building)

See: `.planning/research/FEATURES.md`

---

### Architecture Approach

Three-tier architecture with a clear separation of concerns: Vite/React PWA on Vercel, Fastify API on Railway, Supabase as the managed data layer. The RFID Raspberry Pi is a fourth edge actor that communicates only with the Fastify API using a service-account JWT — it has no direct database access. The frontend never calls Stripe or Twilio directly; all payment and notification actions flow through the Fastify API. The frontend can call Supabase Auth directly and subscribe to Supabase Realtime directly.

Multi-tenancy is enforced at two layers: Fastify extracts `organization_id` from the JWT on every request and attaches it explicitly to all writes; RLS policies enforce it at the database layer as the second line of defense. Role claims live in `app_metadata` (server-writable only), not `user_metadata` (user-writable), injected by a Custom Access Token Auth Hook at JWT mint time.

**Major components:**
1. **Vite/React PWA** — all UI, IndexedDB offline attendance queue (Dexie), Supabase Realtime subscription for live roster updates
2. **Fastify API** — business logic, validation, orchestration, Stripe/Resend/Twilio calls, idempotent webhook handler, RFID endpoint
3. **Supabase Postgres** — source of truth; `organization_id` + RLS on every table; `class_sessions` tracks individual occurrences separate from recurring `classes`
4. **Supabase Auth** — JWT with custom claims (role, organization_id) via Auth Hook; short TTL (15-30 min) for staff accounts
5. **Supabase Realtime** — Postgres Changes streamed to connected PWA clients; channel scoped per session (`attendance:session:{session_id}`)
6. **Stripe** — subscription creation, invoice lifecycle, webhook events drive all billing state transitions
7. **RFID (Raspberry Pi)** — reads card UID, POSTs to `POST /rfid/checkin`; same attendance table as manual; idempotent `ON CONFLICT` insert

**Key data model decisions:**
- `families` + `guardians` (separate table) — billing contact and portal logins are not the same person
- `classes` (recurring slots) + `class_sessions` (individual occurrences) — attendance attaches to sessions, not classes
- `attendance.check_in_method` (`manual`/`rfid`) — supports both paths from day one
- `processed_webhook_events` — Stripe idempotency store with unique constraint on `stripe_event_id`
- `rfid_devices` with `api_key_hash` (bcrypt) — never plaintext device keys

See: `.planning/research/ARCHITECTURE.md`

---

### Critical Pitfalls

1. **iOS Background Sync API does not exist** (Pitfall 3) — Do not use the Background Sync API. It is not implemented in iOS Safari as of 2026. Implement foreground sync instead: on the `online` event and `visibilitychange`, scan IndexedDB and flush pending operations. Show a visible "X records pending sync" indicator. Design for this constraint from day one of offline implementation.

2. **`raw_user_meta_data` role bypass is trivial** (Pitfall 4) — Any parent can call `supabase.auth.updateUser({ data: { role: 'admin' } })` and elevate their own JWT claims if roles live in `user_metadata`. Store roles in `app_metadata` only, injected by a Custom Access Token Auth Hook. This is a Phase 1 decision — every RLS policy is written against this assumption.

3. **Stripe webhook handler must not do synchronous work** (Pitfall 6) — Return 200 immediately, write the event to a `webhook_events` table, process asynchronously. Stripe's 20-second timeout + 3-day retry cycle + lack of idempotency = duplicate SMS/email notifications and angry parents. The `processed_webhook_events` table with a unique constraint on `stripe_event_id` is the defense.

4. **Offline queue ordering corrupts attendance state** (Pitfall 1) — Assign a monotonic sequence number stamped at write time (not sync time) to every queued operation. Drain the queue in sequence order on reconnect. Last-write-wins only within a single student-class-date combination. Test this with a fixture: queue three edits offline (present then absent then late), reconnect, verify final state is "late."

5. **Stripe has five subscription states, not two** (Pitfall 7) — `active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `canceled` all require explicitly defined access rules before writing access control code. `past_due` means portal access with payment banner but blocked new enrollments. `unpaid` means read-only portal. Define the state machine first; the standard test card never exercises the failure states.

**Also flag:** Billing model must be validated with Carollette before writing billing code (Pitfall 13) — monthly tuition per class, annual registration fee, costume deposit, recital fee, sibling discount all map to different Stripe primitives. One 30-minute conversation prevents weeks of rework.

See: `.planning/research/PITFALLS.md`

---

## Implications for Roadmap

The dependency graph from ARCHITECTURE.md is authoritative. Auth and the data model cannot be retrofitted; everything else hangs off them. Suggested six-phase structure:

### Phase 1: Foundation and Auth

**Rationale:** RLS policies, role claims in `app_metadata`, and the multi-tenant schema are the load-bearing decisions for the entire platform. Getting these wrong is not a "fix later" situation — it requires rewriting every policy and potentially migrating data. This phase has no user-visible output, but everything else depends on it.

**Delivers:** Supabase project with full schema (all tables with `organization_id`), RLS policies on every table, Custom Access Token Auth Hook injecting role + org claims into `app_metadata`, Fastify skeleton with JWT middleware + org-context extraction, Vercel + Railway CI/CD pipelines, Vite + React + Tailwind 4 scaffold with design tokens (deep purple, Atkinson Hyperlegible, 18px+ body text). Student/family CRUD with separate `guardians` table.

**Avoids:** Pitfall 4 (role bypass via `user_metadata`), Pitfall 5 (missing `organization_id` tenant leakage), Pitfall 8 (per-row `auth.uid()` — use subselect from day one), Pitfall 17 (family/guardian model conflation).

---

### Phase 2: Classes, Enrollment, and Waitlist

**Rationale:** Classes and enrollments are the join table everything else references. Attendance is meaningless without a roster; billing cannot reference a plan without an enrolled class.

**Delivers:** Class scheduling UI with weekly recurring calendar, enrollment management (open enrollment periods), waitlist queue with auto-notify on spot opening, `class_sessions` row generation (individual occurrence rows for attendance attachment).

**Avoids:** Building attendance before the data model is correct — retrofitting `class_sessions` separation later is a schema migration.

---

### Phase 3: Attendance — Core Value

**Rationale:** Sub-30-second iPad attendance is the platform's reason to exist. Build and validate it with Mrs. Goodman before adding billing complexity.

**Delivers:** Roster-based attendance marking (iPad PWA, large tap targets, optimistic UI), offline-first attendance queue (IndexedDB via Dexie), foreground sync on `online`/`visibilitychange` (no Background Sync API — iOS constraint), "X records pending sync" visible indicator, Supabase Realtime live roster updates (Postgres Changes, scoped per session), RFID endpoint stub (`POST /rfid/checkin`, `rfid_uid` column on students, `rfid_devices` table with `api_key_hash`).

**Uses:** Dexie 4, vite-plugin-pwa, TanStack Query `refetchOnReconnect`, Supabase Realtime.

**Avoids:** Pitfall 1 (offline queue ordering), Pitfall 2 (iOS 7-day cache eviction — populate IndexedDB from login, not service worker cache), Pitfall 3 (no Background Sync API on iOS), Pitfall 9 (RFID duplicate scans — `ON CONFLICT DO UPDATE` + Pi dedup window), Pitfall 14 (network round-trip blocks tap confirmation), Anti-Pattern 5 (deferring RFID data model creates a later migration).

---

### Phase 4: Billing

**Rationale:** Billing depends on families, enrollments, and billing plans. This is the highest-risk phase — define the state machine and validate fee types with Carollette before writing a line of code.

**Pre-phase requirement:** 30-minute Carollette interview on fee types (monthly tuition per class, annual registration fee, costume deposit, recital fee, sibling discount) before any implementation.

**Delivers:** Stripe customer + subscription creation per family, idempotent webhook handler (`processed_webhook_events` table, async processing, immediate 200 response), all five subscription state transitions with correct access rules, invoice display + online payment in parent portal, failed payment dunning (retry + SMS/email), Stripe Customer Portal configured with self-serve cancellation disabled.

**Avoids:** Pitfall 6 (webhook timeout/duplicates), Pitfall 7 (five subscription states), Pitfall 10 (unexpected mid-cycle proration — decide `proration_behavior` policy before coding), Pitfall 13 (billing model mismatch with studio fee types), Pitfall 15 (parents self-cancel mid-season), Anti-Pattern 1 (Stripe calls from frontend), Anti-Pattern 6 (webhook without idempotency store).

---

### Phase 5: Notifications and Parent Portal

**Rationale:** Notifications require billing events (Phase 4) and attendance events (Phase 3) to exist before they can be triggered. The parent portal aggregates data from every subsystem — build it after the data exists.

**Pre-phase requirement:** Twilio A2P 10DLC registration (brand + campaign, ~$14 one-time) — allow 1-2 weeks for carrier approval. Start during Phase 3 or 4 at the latest.

**Delivers:** Resend transactional email (enrollment confirmations, invoice receipts, absence alerts via React Email templates), Twilio SMS (absence alerts, payment failure reminders, studio announcements), parent portal (class schedule, attendance history, invoice ledger, online payment, contact info update, guardian login support).

**Avoids:** Anti-Pattern 3 (Realtime without RLS for parent-scoped data), Pitfall 17 (guardians vs. billing contact — portal uses `guardians` table, not `families.email`).

---

### Phase 6: Admin Dashboard, Recital, and Costume Management

**Rationale:** Lowest dependency, highest deferral priority. The studio operates without recital management; it cannot operate without attendance and billing. Build on top of the complete data model.

**Delivers:** Admin KPI dashboard (enrollment count, monthly revenue, accounts receivable, attendance summary), 5-8 pre-built financial reports, recital and event management (act lineup, running order, volunteer assignments), costume tracking with Postgres enum state machine (`not_ordered | ordered | arrived | distributed | fitted | returned`), makeup class scheduling.

**Avoids:** Pitfall 16 (costume boolean instead of state machine — define enum before building UI).

---

### Phase Ordering Rationale

- Auth and schema before everything: RLS policies reference `app_metadata` role claims; retrofitting this changes every policy. `organization_id` on every table from day one; adding it later is a migration for every table plus data backfill.
- Classes before attendance: attendance attaches to `class_sessions`, which are generated from `classes`. An enrollment joins students to classes; a roster is the attendance input.
- Attendance before billing: validate the core value (sub-30-second iPad attendance) with real users before adding Stripe complexity.
- Billing before notifications: the most critical notifications are payment events driven by Stripe webhooks.
- Parent portal after billing: the portal's invoice view is only useful when invoices exist.
- Recital and costume last: no operational dependency; highest deferral priority.

---

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Offline Attendance):** The interaction between Dexie, TanStack Query, and the service worker update cycle is subtle. iOS PWA cache eviction behavior and foreground sync patterns are documented but require careful implementation sequencing. Recommend a research-phase before detailed task breakdown.
- **Phase 4 (Billing):** Stripe subscription schedules for September-May season billing (with summer break) are not standard SaaS patterns. If Carollette's billing runs seasonally, `subscription_schedules` may be needed — research the pattern once fee types are confirmed.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Supabase RLS + Custom Auth Hook is well-documented in official Supabase docs. Fastify 5 TypeBox provider is the documented recommendation.
- **Phase 2 (Classes/Enrollment):** Standard CRUD with Fastify + Supabase. No novel patterns.
- **Phase 5 (Notifications/Portal):** Resend + Twilio SDK usage is straightforward. Parent portal is read-heavy Supabase queries with RLS — standard pattern.
- **Phase 6 (Reports/Recital):** Reporting is simple SQL aggregates. Recital management is CRUD with a defined state machine.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via Context7 and official release notes. Version numbers confirmed against npm. Three specific breaking changes called out with prevention. |
| Features | HIGH | 10+ competitors surveyed. Table stakes consistent across the market. Differentiators validated against actual user complaints in competitor reviews. |
| Architecture | HIGH | Supabase RLS, Custom Auth Hook, and Realtime patterns sourced from official Supabase docs. Fastify webhook idempotency is a standard pattern. Offline-first architecture well-established. |
| Pitfalls | HIGH | Critical pitfalls sourced from official docs (Stripe webhooks, Supabase auth) and verified iOS limitation (Background Sync API absence confirmed for 2026). RFID deduplication from hardware integration references. |

**Overall confidence: HIGH**

---

### Gaps to Address

- **Carollette fee type interview (critical before Phase 4):** Monthly tuition structure, registration fees, costume deposits, recital fees, sibling discounts must all be mapped to Stripe primitives before billing code is written. One 30-minute conversation prevents weeks of rework.

- **Railway vs. Render decision:** Railway is consumption-based ($5-15/month); Render is flat-rate ($7/month). Neither is free. Confirm which billing model Carollette prefers before committing to infrastructure. Render's predictability may suit a studio owner managing tight costs.

- **Seasonal billing model:** If tuition runs September-May with a summer break, Stripe `subscription_schedules` is the right primitive. If billing is monthly year-round regardless of classes, standard subscriptions suffice. Validate with Carollette.

- **Twilio A2P 10DLC registration timing:** Must be started before Phase 5 begins. 1-2 week carrier approval window. If SMS is wanted at launch, registration must begin during Phase 3 or 4 at the latest.

- **RFID hardware procurement:** If RFID check-in is a launch requirement, a Raspberry Pi + RC522/PN532 reader needs to be procured. The architecture is ready; the hardware timeline needs planning.

---

## Sources

### Primary (HIGH confidence)
- Fastify v5 official docs + v5.8.5 release notes — schema-first patterns, TypeBox provider
- Supabase JS v2 reference + Custom Claims/RBAC guide + RLS guide + Realtime docs — Auth Hook pattern, RLS policy patterns, Postgres Changes
- Stripe Node v22 docs + v18 migration guide + Billing Subscriptions Webhooks — webhook lifecycle, v22 breaking changes, subscription states
- React 19.2 release blog (react.dev) — concurrent features, third-party compatibility
- Tailwind CSS v4.0 release blog — `@theme` directive, `@tailwindcss/vite` plugin
- Resend Node SDK docs — free tier limits, React Email integration
- Twilio SMS Node.js quickstart + pricing — A2P 10DLC requirements, cost estimates at volume
- Official Stripe Docs (Prorations, Customer Portal) — proration behavior, portal configuration

### Secondary (MEDIUM confidence)
- Jackrabbit Dance, DanceStudio-Pro, ClassJuggler, Activity Messenger, iClassPro feature pages — table stakes and differentiator inventory
- AntStack multi-tenant RLS guide, Makerkit Supabase RLS best practices — organization_id isolation patterns
- PWA iOS Limitations / MagicBell 2026 — iOS 7-day cache eviction, Background Sync absence
- Offline Sync Conflict Resolution Patterns (Sachith Dassanayake, Feb 2026) — queue ordering
- DEV Community: 5 Things Wrong With Stripe Billing — webhook timeout, subscription state machine
- Railway vs. Render pricing comparisons — infrastructure cost estimates

### Tertiary (LOW confidence / needs validation)
- Seasonal subscription billing with `subscription_schedules` — inferred from Stripe docs; needs validation against Carollette's actual billing schedule
- Multi-tenant at 10+ studios Supabase scaling projections — estimated from Supabase tier documentation; not load-tested

---

*Research completed: 2026-05-21*
*Ready for roadmap: yes*
