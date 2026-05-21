# Architecture Patterns: LSODance Studio Platform

**Domain:** Dance studio management SaaS — attendance, enrollment, billing, parent portal
**Researched:** 2026-05-21
**Confidence:** HIGH (Supabase/Fastify patterns well-documented; dance studio domain is standard studio management SaaS)

---

## Recommended Architecture

A three-tier architecture with a clear client/API/data boundary. The frontend is a Vite + React PWA deployed to Vercel. The backend is a Fastify API deployed to Railway. The data layer is Supabase (Postgres + Auth + Realtime + Storage) managed as a service.

The RFID device is a fourth, edge actor: a Raspberry Pi that POSTs to the Fastify API exactly like any other client, with its own service-account JWT. It has no direct database access.

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                        │
│                                                                 │
│  iPad PWA (Mrs. Goodman)        Parent Portal PWA              │
│  Admin Dashboard (Carollette)   Instructor View                 │
│  Raspberry Pi RFID reader                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS / WebSocket
┌────────────────────▼────────────────────────────────────────────┐
│  FASTIFY API  (Railway)                                         │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │ Auth        │  │ Attendance  │  │ RFID endpoint        │    │
│  │ middleware  │  │ routes      │  │ POST /rfid/checkin   │    │
│  └─────────────┘  └─────────────┘  └──────────────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │ Students /  │  │ Billing /   │  │ Notifications        │    │
│  │ Enrollment  │  │ Stripe      │  │ Resend + Twilio      │    │
│  └─────────────┘  └─────────────┘  └──────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stripe webhook handler (signature-verified, idempotent) │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────────┘
                     │ Supabase JS client (service role for mutations,
                     │ user-scoped client for RLS-gated reads)
┌────────────────────▼────────────────────────────────────────────┐
│  SUPABASE  (managed Postgres + Auth + Realtime + Storage)       │
│                                                                 │
│  Postgres (shared schema, organization_id RLS on every table)   │
│  Auth (JWT with custom claims: role, organization_id)           │
│  Realtime (Postgres Changes → attendance live updates)          │
│  Storage (costume photos, recital assets)                       │
└─────────────────────────────────────────────────────────────────┘
         │                              │
  ┌──────▼──────┐               ┌───────▼───────┐
  │  Stripe     │               │  Resend /     │
  │  (billing)  │               │  Twilio       │
  └─────────────┘               └───────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Vite/React PWA** | All UI. IndexedDB for offline attendance queue. Supabase Realtime subscription for live updates. | Fastify API (REST), Supabase Realtime (WebSocket) |
| **Fastify API** | Business logic, validation, orchestration, external service calls. Never lets raw Postgres access leak to clients. | Supabase (service role), Stripe, Resend, Twilio |
| **Supabase Postgres** | Source of truth. Multi-tenant via organization_id + RLS. All writes go through API (service role); reads can go through frontend client when RLS is sufficient. | Fastify API, Supabase Realtime |
| **Supabase Auth** | JWT issuance with custom claims (role, organization_id). Auth hook injects claims at token mint time. | Frontend (auth flows), Fastify (JWT verification) |
| **Supabase Realtime** | Streams Postgres Changes (INSERT/UPDATE on attendance table) to subscribed frontend clients. | Frontend PWA |
| **Supabase Storage** | Costume photos, recital media. Presigned URLs served from Fastify. | Fastify API, Frontend |
| **RFID (Raspberry Pi)** | Reads card UID, POSTs to `POST /rfid/checkin` with device JWT. No other access. | Fastify API only |
| **Stripe** | Subscription creation, invoice lifecycle, payment processing. Sends webhook events to Fastify. | Fastify API (webhook receiver + API calls) |
| **Resend** | Transactional email (enrollment confirmations, invoice receipts, absence alerts). | Fastify API only |
| **Twilio** | SMS (absence alerts, payment reminders, announcements). | Fastify API only |

**Key boundary rule:** The frontend never calls Stripe or Twilio directly. All payment and notification actions flow through the Fastify API. The frontend can call Supabase Auth directly and can subscribe to Supabase Realtime directly.

---

## Data Flow

### Attendance — Manual (iPad, Mrs. Goodman)

```
1. Mrs. Goodman taps student name on roster
2. PWA writes optimistic update to IndexedDB (immediate UI feedback)
3. PWA POSTs to Fastify: PATCH /attendance/:id { status: "present" }
4. Fastify validates auth (JWT), validates org, writes to Postgres
5. Postgres change triggers Supabase Realtime
6. All connected clients (e.g., admin dashboard) receive the update via WebSocket
7. PWA receives 200 OK, marks IndexedDB record as synced

IF OFFLINE:
2a. Write to IndexedDB sync queue: { endpoint, method, body, timestamp }
2b. Service worker registers background sync tag
2c. When connectivity restores, service worker drains queue in order
2d. Last-write-wins for attendance (server timestamp wins on conflict)
```

### Attendance — RFID (Raspberry Pi)

```
1. Student taps card on reader
2. Pi reads UID via SPI (RC522/PN532)
3. Pi POSTs to Fastify: POST /rfid/checkin { uid: "XXXX", device_id: "pi-studio-1" }
4. Fastify looks up student by rfid_uid, resolves active class session
5. Fastify writes attendance record (same table as manual)
6. Supabase Realtime broadcasts update to all connected frontends
7. Pi receives 200 OK with student name; displays on LCD
```

### Billing — Stripe Subscription Lifecycle

```
1. Admin creates/enrolls student, selects billing plan in frontend
2. Frontend sends enrollment request to Fastify
3. Fastify creates Stripe Customer + Subscription via Stripe API
4. Fastify stores stripe_customer_id, stripe_subscription_id on family record
5. Stripe processes recurring charge each billing cycle

WEBHOOK EVENTS (Stripe → Fastify POST /webhooks/stripe):
  invoice.paid              → mark invoice paid, send receipt email via Resend
  invoice.payment_failed    → update family status, send SMS via Twilio
  customer.subscription.deleted → suspend family access

Idempotency: Fastify stores processed stripe_event_id; ignores duplicates.
```

### Parent Portal — Read-Heavy Flow

```
1. Parent logs in via Supabase Auth (email/password)
2. JWT issued with custom claims: { role: "parent", org_id: "...", family_id: "..." }
3. Frontend can call Supabase directly for read-only data (classes, attendance history)
   — RLS policies enforce family_id isolation
4. For writes (update contact info, pay invoice): frontend calls Fastify API
5. Fastify re-validates JWT, performs write with service role
```

### Notifications — Outbound

```
Trigger (Fastify internal, or Stripe webhook):
  → Resend SDK call for email (enrollment confirmations, receipts)
  → Twilio SDK call for SMS (absence alerts, payment failures)
  → Notification record written to Postgres (audit trail)
```

---

## Multi-Tenant Data Model

Every table carries `organization_id uuid NOT NULL` as the first non-PK column. RLS policies enforce it.

```sql
-- Template RLS policy (applied to every table)
CREATE POLICY "tenant_isolation" ON students
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Role-based access layered on top
CREATE POLICY "admin_full_access" ON students
  FOR ALL USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

The Supabase Auth Hook (Postgres function) injects `organization_id` and `role` into `app_metadata` at JWT mint time. This means:
- RLS policies never hit the `user_profiles` table on every query — claims are in the token.
- Fastify can verify tenant context without a DB round-trip per request.

**RFID device:** Uses a service-account JWT scoped to a single org. The Fastify endpoint verifies the device `Authorization` header against a stored `api_key_hash` in the `rfid_devices` table, then uses the service role client to write.

---

## Offline-First Attendance Architecture

The offline queue lives in IndexedDB, managed by Dexie.js. The service worker handles sync.

```
IndexedDB stores:
  attendance_queue: { id, endpoint, method, body, timestamp, retries, status }
  cached_rosters:   { class_id, date, students[], fetched_at }

Sync protocol:
  1. Always write to IndexedDB first (optimistic)
  2. If online: immediately send to Fastify API
     - 200: mark as synced, remove from queue
     - 4xx: mark as failed (bad data, log for review)
     - 5xx/network error: keep in queue, retry on reconnect
  3. If offline: service worker Background Sync API queues the retry
  4. On reconnect: drain queue in chronological order

Conflict model: Last-write-wins by server timestamp.
Attendance records are simple state transitions (absent → present → late).
The same student cannot have two conflicting states; the API takes the
latest server-received record as authoritative.
```

Each queued operation carries a client-generated UUID as `X-Idempotency-Key`. Fastify deduplicates by key with a short TTL, preventing double-submission on retry.

---

## Supabase Realtime — Live Attendance Updates

Use Postgres Changes, not raw Broadcast, for attendance updates. Postgres Changes respects RLS automatically, so instructors only receive updates for classes they can access.

```typescript
// Frontend subscribes when a class session is opened
const channel = supabase
  .channel(`attendance:session:${sessionId}`)
  .on('postgres_changes', {
    event: '*',           // INSERT and UPDATE
    schema: 'public',
    table: 'attendance',
    filter: `class_session_id=eq.${sessionId}`,
  }, (payload) => updateRosterUI(payload))
  .subscribe();
```

Channel naming convention: `attendance:session:{session_id}` — scoped per session to avoid unnecessary fan-out.

---

## Role-Based Access Control

Three roles, enforced at two layers: Fastify middleware (route-level) and Postgres RLS (data-level).

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| **admin** | Everything — CRUD on all entities, billing management, user management, reports | — |
| **instructor** | View assigned classes, mark attendance for own classes, view own student rosters | Access billing, manage other instructors' classes, admin reports |
| **front_desk** | Take attendance for any class, view all rosters, view student contact info | Billing management, class creation, financial reports |
| **parent** | View own family's classes, attendance history, invoices; pay invoices; update own family info | Access any other family's data, studio management |

Role is stored in Supabase Auth `app_metadata` (injected by the Auth Hook), not `user_metadata` (which the user can write). `app_metadata` is server-writable only — this is Supabase's recommended pattern for immutable role claims.

---

## Core Data Model (Logical)

```
organizations
  id, name, slug, settings_json, created_at

families
  id, organization_id, primary_contact_name, email, phone,
  stripe_customer_id, balance_cents, status

students
  id, organization_id, family_id, first_name, last_name,
  birthdate, rfid_uid (nullable), photo_url, notes, active

classes
  id, organization_id, name, instructor_id, room,
  day_of_week, start_time, end_time, max_capacity, active

class_sessions          -- one row per scheduled class occurrence
  id, class_id, date, instructor_id, status, notes

enrollments             -- student <-> class (many-to-many)
  id, organization_id, student_id, class_id,
  enrolled_at, status, billing_plan_id

attendance              -- one row per student per session
  id, organization_id, class_session_id, student_id,
  status (present/absent/late/excused),
  check_in_method (manual/rfid),
  recorded_by, recorded_at

invoices
  id, organization_id, family_id, stripe_invoice_id,
  amount_cents, due_date, paid_at, status

rfid_devices
  id, organization_id, device_name, api_key_hash, last_seen_at

processed_webhook_events  -- Stripe idempotency store
  id, stripe_event_id, processed_at
```

Every table has `organization_id`. Foreign keys reference within the same org; RLS enforces the tenant boundary at the database level as a second line of defense after application-level validation.

---

## Suggested Build Order (Phase Dependencies)

The dependency graph drives the sequence. Each layer is a prerequisite for the next.

### Layer 1: Foundation (nothing else can be built without this)
1. **Supabase project + schema** — organizations, users, RLS template policies, Auth Hook
2. **Fastify API skeleton** — JWT middleware, health check, error format, CORS, org-context extraction
3. **Vercel + Railway deployment** — CI/CD pipelines, environment variables, secrets management
4. **Vite + React + Tailwind scaffold** — design system tokens, Atkinson Hyperlegible, component shell

### Layer 2: Core Domain (blocked on Layer 1)
5. **Students and families CRUD** — the entity everything else references
6. **Classes and scheduling** — defines what sessions exist; required before enrollment or attendance
7. **Enrollment** — connects students to classes; required for attendance to be meaningful

### Layer 3: Daily Operations (blocked on Layer 2)
8. **Attendance — manual iPad PWA** — the core value prop; needs classes + enrollment
9. **Offline queue + service worker sync** — reliability layer on top of manual attendance
10. **RFID endpoint** — `POST /rfid/checkin` + `rfid_devices` table; low scope once manual works
11. **Supabase Realtime subscriptions** — live roster updates on the attendance table

### Layer 4: Money (blocked on families + enrollment)
12. **Stripe customer + subscription creation** — needs families and billing plans to exist
13. **Stripe webhook handler** — needs customers; drives all billing state transitions
14. **Invoice display + payment in parent portal** — needs webhooks to drive state

### Layer 5: Communication (blocked on families + attendance + billing events)
15. **Resend email notifications** — triggered by enrollment, invoice, attendance events
16. **Twilio SMS notifications** — absence alerts, payment reminders, announcements

### Layer 6: Portals and Reporting (blocked on everything above)
17. **Parent portal** — read-heavy; needs full data model to be useful
18. **Admin dashboard + KPIs** — aggregates across students, attendance, billing
19. **Recital and costume management** — lowest dependency, highest deferral priority

**Rationale for this order:**

- Auth before anything else — role-based data isolation cannot be retrofitted safely.
- Students/families before classes because enrollment joins them; classes before enrollment for the same reason.
- Manual attendance before RFID because Mrs. Goodman's iPad flow is the core value prop and has no hardware dependency.
- Billing after class structure because Stripe subscriptions reference billing plans tied to classes.
- Notifications after billing because the most critical notifications are payment events.
- Parent portal last among user-facing features because it aggregates data from every other subsystem.
- RFID endpoint stub created in Layer 3 even if no Pi is connected — retrofitting the data model later costs more than a stub endpoint now.

---

## Scalability Considerations

| Concern | At 1 studio (75-150 students) | At 10 studios (future licensing) | At 100 studios |
|---------|-------------------------------|----------------------------------|----------------|
| Database | Supabase free tier sufficient | Same schema, Supabase Pro; RLS isolates tenants automatically | Supabase Enterprise or self-hosted; consider read replicas |
| Realtime | Free tier (200 concurrent) more than sufficient | Pro tier (10K concurrent); partition channels by org | Monitor channel fan-out per org |
| RFID writes | Single Pi, low throughput; point writes only | One Pi per studio, aggregate throughput still low | No scale concern |
| Stripe | No scale concern at this tier | Stripe handles any volume; webhook idempotency already built in | — |
| Storage | Free tier sufficient for costume photos | S3 migration path via Supabase Storage provider swap | CDN-backed |

The multi-tenant schema is the single decision that makes future licensing low-friction. Every org shares the database; RLS enforces isolation. Adding tenant #2 requires no schema migration and no infrastructure change.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Frontend calling Stripe directly
**What goes wrong:** Stripe secret key leaks to the browser; payment amounts become client-manipulable.
**Instead:** All Stripe API calls originate from Fastify. Frontend only receives a client secret (for Stripe Payment Element) that the API generates and passes down.

### Anti-Pattern 2: Writing attendance without organization_id at the API layer
**What goes wrong:** RLS catches it (good) with a confusing error. Or, if using the service role, cross-tenant data contamination with no error.
**Instead:** Fastify middleware extracts `organization_id` from the JWT on every request and attaches it to all write operations explicitly. Never trust the client to supply it.

### Anti-Pattern 3: Supabase Realtime subscriptions without RLS
**What goes wrong:** Instructors receive attendance updates for classes they do not teach; parents can subscribe to other families' data.
**Instead:** Use Postgres Changes (RLS-enforced) not raw Broadcast for attendance data. Verify Realtime Authorization is enabled on sensitive channels.

### Anti-Pattern 4: Offline queue with no idempotency key
**What goes wrong:** Network blip causes double-submission of the same attendance record.
**Instead:** Each queued operation carries a client-generated UUID as `X-Idempotency-Key`. Fastify deduplicates by key with a short TTL.

### Anti-Pattern 5: Deferring the RFID endpoint and data model
**What goes wrong:** Adding `rfid_uid` to students and `rfid_devices` table later requires a migration and data backfill.
**Instead:** Build `POST /rfid/checkin` and the `rfid_uid` column on students in Layer 3, even with no Pi connected. The endpoint can return 501 until the Pi is ready. Near-zero retrofit cost later.

### Anti-Pattern 6: Stripe webhook handler without idempotency store
**What goes wrong:** Stripe retries for up to 3 days on 5xx. A transient error causes double invoice-paid processing, double emails, incorrect balance.
**Instead:** Store `stripe_event_id` in a `processed_webhook_events` table. Check existence before processing. Respond 200 even for duplicates.

### Anti-Pattern 7: Storing RFID device API keys in plaintext
**What goes wrong:** Pi is physically accessible in the studio; a stolen key grants attendance write access.
**Instead:** Store `api_key_hash` (bcrypt) in the `rfid_devices` table. The Pi holds the plaintext key in its environment only.

---

## Phase-Specific Architecture Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth + RLS | Forgetting to enable RLS on new tables | Enforce in migration script: `ALTER TABLE x ENABLE ROW LEVEL SECURITY; ALTER TABLE x FORCE ROW LEVEL SECURITY;` |
| Offline attendance | Background Sync API not available in all iOS Safari versions | Fallback: `online` event listener + manual queue drain; Background Sync is enhancement, not requirement |
| Stripe webhooks | `stripe.webhooks.constructEvent` throws if body is JSON-parsed before signature check | Use Fastify `addContentTypeParser` to preserve raw body on the webhook route; do not apply JSON parser there |
| Supabase Realtime | Free tier caps at 200 concurrent connections | Set up Realtime reports; plan Pro tier upgrade when second studio onboards |
| Parent portal | Parents should never see sibling family data even via direct URL manipulation | RLS enforces `family_id` isolation at DB layer; Fastify also validates on every parent-scoped write |
| RFID endpoint | Pi may POST during class transitions when no session is active | Return 404 with clear message; Pi should display "No active class" rather than silently dropping |

---

## Sources

- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) — Elixir cluster, channel model, Postgres Changes via logical replication (HIGH confidence)
- [Subscribing to Database Changes | Supabase](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — Postgres Changes filters, RLS applicability (HIGH confidence)
- [Custom Claims and RBAC | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — Auth Hook pattern for role injection into JWT (HIGH confidence)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy patterns (HIGH confidence)
- [Multi-Tenant Applications with RLS on Supabase | AntStack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — organization_id isolation pattern (MEDIUM confidence)
- [Supabase RLS Best Practices | Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — production multi-tenant patterns (MEDIUM confidence)
- [fastify-supabase plugin | GitHub](https://github.com/psteinroe/fastify-supabase) — service role vs user-scoped client separation in Fastify (MEDIUM confidence)
- [Using webhooks with subscriptions | Stripe](https://docs.stripe.com/billing/subscriptions/webhooks) — subscription lifecycle events (HIGH confidence)
- [Handling Payment Webhooks Reliably | Medium](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) — idempotency key pattern (MEDIUM confidence)
- [Offline-first PWA with IndexedDB and Supabase | Medium](https://oluwadaprof.medium.com/building-an-offline-first-pwa-notes-app-with-next-js-indexeddb-and-supabase-f861aa3a06f9) — sync queue architecture (MEDIUM confidence)
- [PWA, IndexedDB, and a Reliable Queue | Medium](https://medium.com/@11.sahil.kmr/offline-first-by-design-pwa-indexed-db-and-a-reliable-queue-775605b3d76c) — offline-first design patterns (MEDIUM confidence)
- [Row Level Security for Tenants in Postgres | Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) — session-based tenant context with `current_setting` (MEDIUM confidence)
- [Raspberry Pi RFID Attendance System | Pi My Life Up](https://pimylifeup.com/raspberry-pi-rfid-attendance-system/) — RC522/PN532 hardware integration reference (MEDIUM confidence)
