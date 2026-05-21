<!-- generated-by: gsd-doc-writer -->
# Domain Model: LSODance Studio Platform

This document is the authoritative reference for every database entity in the platform. It covers Postgres field types, relationships, design rationale, and the multi-tenant patterns enforced across all tables.

**Stack:** Supabase (Postgres) · Fastify API · Stripe billing · Supabase Auth with custom JWT claims

---

## Core Design Principles

### Multi-tenancy: `organization_id` on every table

Every table carries `organization_id uuid NOT NULL` as the first non-PK column. This is set at write time by the Fastify API layer from the JWT claim — never trusted from the client payload. Supabase RLS policies enforce tenant isolation at the database level as a second line of defense.

```sql
-- Template RLS policy applied to every table
CREATE POLICY "tenant_isolation" ON <table>
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
  );
```

### Roles in `app_metadata`, not `user_metadata`

Roles (`admin`, `instructor`, `front_desk`, `parent`) live in `app_metadata` in the Supabase Auth JWT. This field is server-writable only — a parent cannot escalate their own role via `supabase.auth.updateUser()`. `user_metadata` is user-writable and must never be used for authorization decisions.

The Supabase Auth Hook (a Postgres function) injects `organization_id` and `role` into `app_metadata` at JWT mint time, so RLS policies and Fastify middleware can verify tenant context without a DB round-trip per request.

### `class_sessions` separates schedules from instances

`classes` defines a recurring class (e.g., "Ballet I — Tuesdays 4pm"). `class_sessions` represents each individual occurrence of that class (e.g., "Ballet I — Tuesday, June 3, 2026"). Attendance records link to `class_sessions`, not `classes`, so the historical record is preserved even if a class is rescheduled or cancelled.

### Stripe IDs stored on the relevant entities

- `stripe_customer_id` on `families` — one Stripe customer per billing family
- `stripe_price_id` on `tuition_plans` — maps each plan to its Stripe Price object
- `stripe_subscription_id` on `enrollments` — each active enrollment may carry an active Stripe subscription
- `stripe_invoice_id` on `invoices` — every Supabase invoice row mirrors a Stripe invoice
- `stripe_payment_intent_id` on `payments` — for one-time payments and charge-level tracking

---

## Entity Groups

- [Core](#core)
- [Billing](#billing)
- [Staff](#staff)
- [Communication](#communication)
- [Events](#events)

---

## Core

### `organizations`

The top-level tenant entity. Every other table references this.

```sql
CREATE TABLE organizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,           -- URL-safe identifier, e.g. "lsodance"
  email             text,                           -- studio contact email
  phone             text,                           -- studio contact phone
  address           text,
  timezone          text NOT NULL DEFAULT 'America/Detroit',
  settings          jsonb NOT NULL DEFAULT '{}',    -- org-level config (branding, feature flags)
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

**Relationships:**
- Has many `families`, `students`, `classes`, `staff`, `events`, etc. via `organization_id`

**Design notes:**
- `slug` is the URL-safe tenant identifier used in multi-tenant routing (e.g., `app.lsodance.com/lsodance/classes`). Unique across the platform
- `settings` (jsonb) holds org-level configuration: brand color overrides, notification preferences, recital dates. Avoids an `organization_settings` join table for small config
- `timezone` drives all date/time display and billing cycle calculations. Dance studios span timezones when the platform is licensed; defaults to Detroit for the v1 studio

---

### `families`

A billing and contact unit. A family can have one or more students. Parents authenticate as a family account and see only their own data.

```sql
CREATE TABLE families (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  primary_contact_name    text NOT NULL,
  email                   text NOT NULL,
  phone                   text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  address                 text,
  stripe_customer_id      text,                      -- Stripe Customer ID (cus_...)
  balance_cents           integer NOT NULL DEFAULT 0, -- running credit/debit balance
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'suspended')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_families_org ON families(organization_id);
CREATE UNIQUE INDEX idx_families_org_email ON families(organization_id, email);
CREATE INDEX idx_families_stripe ON families(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

**Relationships:**
- Belongs to `organizations`
- Has many `students`
- Has many `invoices`
- Has many `payments`
- Has many `discounts` (family-level discounts)

**Design notes:**
- `stripe_customer_id` is set when the family's first enrollment triggers Stripe customer creation. Null until billing is active for the family
- `balance_cents` holds prepaid credits or outstanding balance. Negative = family owes; positive = credit on account. The Fastify billing service reconciles this against invoices
- `status: 'suspended'` is set automatically when a payment has been `unpaid` past the configured grace period. Suspended families lose parent portal access until resolved
- `email` is unique per organization (unique index enforces this) — it is the parent login credential for Supabase Auth

---

### `students`

An individual dancer. Students belong to a family and are enrolled in classes.

```sql
CREATE TABLE students (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_id       uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  birthdate       date,
  skill_level     text CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'pre-professional')),
  photo_url       text,                    -- Supabase Storage path (not a presigned URL)
  medical_notes   text,                    -- allergies, injuries, accommodations; admin/instructor only
  rfid_uid        text,                    -- raw card UID from RC522/PN532, e.g. "A3F2B9C1"
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_org ON students(organization_id);
CREATE INDEX idx_students_family ON students(family_id);
CREATE UNIQUE INDEX idx_students_rfid_org ON students(organization_id, rfid_uid) WHERE rfid_uid IS NOT NULL;
CREATE INDEX idx_students_active ON students(organization_id, active);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `families`
- Has many `enrollments`
- Has many `attendance_records` (via `class_sessions`)
- Has one `rfid_cards` record (optional, when a card is assigned)
- Has many `event_enrollments`
- Has many `costumes`

**Design notes:**
- `rfid_uid` is stored directly on the student for fast RFID lookup — `SELECT * FROM students WHERE organization_id = $1 AND rfid_uid = $2`. The partial unique index makes this a single O(1) lookup on `POST /rfid/checkin`, with no join required
- `photo_url` points to a Supabase Storage path. Fastify generates presigned URLs on demand; the value stored here is the storage object path, not an expiring signed URL
- `medical_notes` is visible to admin and instructors only. RLS policy or API response shaping excludes this field from front_desk and parent responses
- `skill_level` uses a closed enum; the Fastify route schema rejects values outside this set before the query reaches Postgres

---

### `classes`

A recurring class definition (the schedule template). Does not represent individual occurrences — see `class_sessions`.

```sql
CREATE TABLE classes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  class_type      text NOT NULL
                    CHECK (class_type IN ('ballet', 'hip_hop', 'jazz', 'contemporary', 'tap', 'acrobatics', 'musical_theater', 'other')),
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  room            text,
  max_capacity    integer NOT NULL DEFAULT 20,
  min_age         smallint,                        -- minimum age in years (inclusive)
  max_age         smallint,                        -- maximum age in years (inclusive)
  skill_level     text CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'pre-professional', 'all')),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_org ON classes(organization_id);
CREATE INDEX idx_classes_day ON classes(organization_id, day_of_week) WHERE active = true;
```

**Relationships:**
- Belongs to `organizations`
- Has many `class_sessions`
- Has many `enrollments`
- Has many `class_instructors` (join table to `staff`)
- Has many `tuition_plans`

**Design notes:**
- `day_of_week` uses smallint (0=Sunday through 6=Saturday). The API layer converts to human-readable day names for display. The `date-fns` library handles DST-safe scheduling calculations
- `start_time` and `end_time` are Postgres `time` type (time-of-day only, no date, no timezone). Timezone conversion is applied in the application layer using the organization's `timezone` setting
- A class definition is intentionally minimal — it does not vary per session. Instance-level variation (substitution instructor, cancellation) lives on `class_sessions`
- When `active` is set to false, no new `class_sessions` are generated and new enrollments are rejected. Historical sessions and records are preserved

---

### `class_sessions`

One row per scheduled occurrence of a class. This is what attendance records, substitutions, and session-level notes attach to.

```sql
CREATE TABLE class_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date    date NOT NULL,
  start_time      time NOT NULL,     -- copied from class at generation time
  end_time        time NOT NULL,     -- copied from class at generation time
  instructor_id   uuid REFERENCES staff(id), -- session-level override; null = use class_instructors
  status          text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sessions_class_date ON class_sessions(class_id, session_date);
CREATE INDEX idx_sessions_org_date ON class_sessions(organization_id, session_date);
CREATE INDEX idx_sessions_status ON class_sessions(organization_id, status, session_date);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `classes`
- Belongs to `staff` (session-level instructor override, nullable)
- Has many `attendance_records`

**Design notes:**
- `start_time` and `end_time` are copied from the parent class at session generation time, not looked up dynamically. This preserves the historical record if a class time changes — past sessions reflect the time they actually ran
- Sessions are generated ahead of time (e.g., a full semester) by a scheduled Fastify job. The job is idempotent — the unique index on `(class_id, session_date)` prevents duplicates
- The `status` field drives the front desk UI: the class selection screen shows sessions with `status = 'scheduled'` or `'in_progress'` for today's date. Completed sessions show a checkmark and timestamp
- `instructor_id` on the session overrides the class's assigned instructor for that day (substitution). Null means no override; the frontend resolves the instructor from `class_instructors` instead
- Supabase Realtime subscriptions are scoped per session: channel `attendance:session:{session_id}`. This avoids unnecessary fan-out to unrelated sessions

---

### `enrollments`

The join between a student and a class. An enrollment is active for as long as the student is taking that class.

```sql
CREATE TABLE enrollments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id              uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id                uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tuition_plan_id         uuid REFERENCES tuition_plans(id),
  stripe_subscription_id  text,          -- Stripe Subscription ID (sub_...), set when billing activates
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'waitlist', 'dropped', 'transferred')),
  waitlist_position       smallint,      -- set only when status = 'waitlist'
  enrolled_at             timestamptz NOT NULL DEFAULT now(),
  dropped_at              timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_enrollments_active_pair ON enrollments(student_id, class_id)
  WHERE status IN ('active', 'waitlist');
CREATE INDEX idx_enrollments_org ON enrollments(organization_id);
CREATE INDEX idx_enrollments_class_status ON enrollments(class_id, status);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `students`
- Belongs to `classes`
- Belongs to `tuition_plans` (nullable — scholarship/staff-family students may be enrolled without billing)
- Has many `attendance_records` (indirectly, via student + class_session lookups)

**Design notes:**
- The unique partial index on `(student_id, class_id) WHERE status IN ('active', 'waitlist')` prevents a student from being enrolled or waitlisted twice in the same class. Dropped and transferred records accumulate as history
- `waitlist_position` is only meaningful when `status = 'waitlist'`. When a spot opens (a drop occurs), Fastify re-numbers positions and promotes the top waitlist entry to `active`. A Postgres trigger or a Fastify background job handles the promotion
- `stripe_subscription_id` is set when billing activates for this enrollment. One active enrollment = one Stripe subscription. When a student drops, the subscription is cancelled via the Stripe API; a `customer.subscription.deleted` webhook confirms the cancellation and updates this field
- `tuition_plan_id` can be null for staff-family students or students with a 100% discount applied — enrolled but never billed

---

### `attendance_records`

One row per student per class session. The core output of the daily attendance flow.

```sql
CREATE TABLE attendance_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'absent'
                     CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_method  text NOT NULL DEFAULT 'manual'
                     CHECK (check_in_method IN ('manual', 'rfid')),
  marked_by        uuid REFERENCES staff(id),        -- staff who marked; null for RFID
  rfid_device_id   uuid REFERENCES rfid_devices(id), -- Pi that checked in; null for manual
  client_sequence  bigint,   -- monotonic client-side sequence number for offline ordering
  idempotency_key  text,     -- client-generated UUID for deduplication on retry
  notes            text,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_attendance_session_student ON attendance_records(class_session_id, student_id);
CREATE INDEX idx_attendance_org ON attendance_records(organization_id);
CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, recorded_at DESC);
CREATE INDEX idx_attendance_session ON attendance_records(class_session_id);
CREATE INDEX idx_attendance_idempotency ON attendance_records(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `class_sessions`
- Belongs to `students`
- Belongs to `staff` (the `marked_by` staffer, nullable for RFID check-ins)
- Belongs to `rfid_devices` (the Pi that recorded it, nullable for manual marks)

**Design notes:**
- The unique index on `(class_session_id, student_id)` enforces one record per student per session. On conflict from a retried offline queue flush, the API uses `INSERT ... ON CONFLICT DO UPDATE` with a `recorded_at` timestamp comparison to apply last-write-wins within the same student+session pair
- `client_sequence` is a monotonic integer stamped by the PWA at write time (not sync time). The Fastify endpoint uses this to enforce ordering when draining a flushed offline queue — it rejects operation N+2 until N+1 has been processed for the same student+session combination
- `idempotency_key` is a client-generated UUID sent as the `X-Idempotency-Key` header on every attendance write. Fastify deduplicates by this key, preventing double-submission on retry. The partial index enables fast lookup
- `check_in_method` drives the admin dashboard KPI "RFID check-ins today" and distinguishes the two attendance input paths in reports
- For any given record, exactly one of `marked_by` or `rfid_device_id` will be non-null — not both
- Supabase Realtime uses Postgres Changes on this table, filtered by `class_session_id`, to push live updates to the front desk iPad and admin dashboard without polling

---

### `rfid_cards`

Maps a physical RFID card to a student. Separating the card from the student allows card reassignment without altering the student record.

```sql
CREATE TABLE rfid_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  card_uid        text NOT NULL,     -- raw UID from RC522/PN532 reader, e.g. "A3F2B9C1"
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rfid_cards_uid_org ON rfid_cards(organization_id, card_uid) WHERE active = true;
CREATE INDEX idx_rfid_cards_student ON rfid_cards(student_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `students`

**Design notes:**
- `card_uid` is unique per organization for active cards. Reassigning a card means deactivating the current record and creating a new one — the history of which card a student had is preserved
- `students.rfid_uid` also stores the card UID directly. The `rfid_cards` table is the management and historical record. The `students.rfid_uid` column is the hot path for `POST /rfid/checkin` — a single indexed lookup with no join required
- When a new card is assigned via the admin UI, both `students.rfid_uid` and a new `rfid_cards` row are updated in a single Fastify transaction

---

### `rfid_devices`

The Raspberry Pi check-in hardware. Each Pi is registered as a device with its own hashed API key.

```sql
CREATE TABLE rfid_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_name     text NOT NULL,     -- human label, e.g. "Studio Front Desk Pi"
  api_key_hash    text NOT NULL,     -- bcrypt hash of the device's API key
  last_seen_at    timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfid_devices_org ON rfid_devices(organization_id);
```

**Relationships:**
- Belongs to `organizations`
- Has many `attendance_records` (as the source device)

**Design notes:**
- `api_key_hash` stores a bcrypt hash. The Pi holds the plaintext key in its environment only. Storing plaintext would be exploitable if the Pi is physically stolen — it sits on a studio front desk
- `last_seen_at` is updated on every successful `POST /rfid/checkin`. Useful for device health monitoring on the admin dashboard
- The Fastify endpoint verifies the device key using `bcrypt.compare(incomingKey, api_key_hash)` before processing any RFID check-in. The verification result is not cached — the cost is acceptable at RFID check-in frequency

---

## Billing

### `tuition_plans`

Defines a billing rate for a class. Each plan maps to a Stripe Price object for recurring billing.

```sql
CREATE TABLE tuition_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id         uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name             text NOT NULL,        -- e.g. "Ballet I Monthly Tuition"
  billing_type     text NOT NULL
                     CHECK (billing_type IN ('monthly', 'per_session', 'seasonal')),
  amount_cents     integer NOT NULL,     -- base amount before discounts
  billing_day      smallint CHECK (billing_day BETWEEN 1 AND 28), -- day of month for monthly; null for seasonal
  stripe_price_id  text,                 -- Stripe Price ID (price_...) for recurring plans
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tuition_plans_org ON tuition_plans(organization_id);
CREATE INDEX idx_tuition_plans_class ON tuition_plans(class_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `classes`
- Has many `enrollments` (a plan can serve multiple students in the class)
- Has many `discounts` (plan-level discount overrides)

**Design notes:**
- `billing_day` is capped at 28 to avoid February edge cases. The Fastify billing job uses this to determine when to create the Stripe invoice for the current month
- `stripe_price_id` is set when the admin activates billing for a plan. If the plan amount changes, a new Stripe Price is created and the old one is archived — Stripe does not allow editing an active Price's amount
- `billing_type: 'seasonal'` is used for one-time charges (e.g., a recital fee or workshop). These use Stripe Payment Intents rather than Subscriptions. `billing_day` is null for seasonal plans

---

### `invoices`

One invoice per billing cycle per family. Mirrors the Stripe invoice with local state for display and reporting.

```sql
CREATE TABLE invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_id          uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  stripe_invoice_id  text UNIQUE,        -- Stripe Invoice ID (in_...)
  amount_cents       integer NOT NULL,   -- total due after discounts
  discount_cents     integer NOT NULL DEFAULT 0, -- aggregate discount applied
  due_date           date,
  paid_at            timestamptz,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'past_due', 'unpaid', 'waived', 'void')),
  payment_method     text CHECK (payment_method IN ('stripe', 'cash', 'check', 'waived')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_family ON invoices(family_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `families`
- Has many `payments`

**Design notes:**
- Status transitions: `pending` → `paid` (on `invoice.payment_succeeded` webhook), `past_due` (after `due_date` passes unpaid), `unpaid` (after Stripe retry exhaustion), `waived` (admin manual action), or `void` (cancelled before any payment attempt)
- `stripe_invoice_id` may be null for cash/check invoices created manually by the admin outside the Stripe flow
- `discount_cents` is the aggregate discount applied across all line-item discounts for this invoice. Stored here for reporting without joining discount tables on every query
- The Stripe webhook handler writes to this table. It is idempotent: the `processed_webhook_events` table prevents double-processing. The handler responds HTTP 200 even for duplicate events

---

### `payments`

Records individual payment events — whether from Stripe, cash, or check.

```sql
CREATE TABLE payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_id                uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invoice_id               uuid REFERENCES invoices(id),
  stripe_payment_intent_id text,          -- Stripe PaymentIntent ID (pi_...)
  amount_cents             integer NOT NULL,
  method                   text NOT NULL
                             CHECK (method IN ('stripe', 'cash', 'check')),
  status                   text NOT NULL DEFAULT 'succeeded'
                             CHECK (status IN ('succeeded', 'failed', 'refunded', 'pending')),
  recorded_by              uuid REFERENCES staff(id), -- staff member for cash/check; null for Stripe
  notes                    text,
  paid_at                  timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_family ON payments(family_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `families`
- Belongs to `invoices` (nullable — a payment can be unallocated until matched to an invoice)
- Belongs to `staff` (the `recorded_by` staffer for cash/check; null for Stripe)

**Design notes:**
- Cash and check payments are created manually by a staff member. `recorded_by` is required for these — it creates an audit trail for the admin
- `invoice_id` may be null for a prepayment or credit. The billing service allocates credits against open invoices in a separate reconciliation step
- `stripe_payment_intent_id` enables looking up charge-level details from Stripe. Required for initiating refunds through the Stripe API

---

### `discounts`

Discount rules that reduce tuition. Applied at the family level, the plan level, or both.

```sql
CREATE TABLE discounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  family_id       uuid REFERENCES families(id),       -- null = not family-specific
  tuition_plan_id uuid REFERENCES tuition_plans(id),  -- null = applies to all plans for the family
  name            text NOT NULL,     -- e.g. "Sibling Discount", "Carollette Williams Scholarship"
  discount_type   text NOT NULL
                    CHECK (discount_type IN ('percentage', 'fixed_cents')),
  value           numeric(8,4) NOT NULL, -- percentage (0.00 to 100.00) or amount in cents
  reason          text CHECK (reason IN ('sibling', 'scholarship', 'staff', 'promotional', 'other')),
  active          boolean NOT NULL DEFAULT true,
  valid_from      date,
  valid_through   date,
  created_by      uuid REFERENCES staff(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discounts_org ON discounts(organization_id);
CREATE INDEX idx_discounts_family ON discounts(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_discounts_plan ON discounts(tuition_plan_id) WHERE tuition_plan_id IS NOT NULL;
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `families` (nullable — org-wide promotional discounts have no family_id)
- Belongs to `tuition_plans` (nullable — a family-level discount may apply across all their plans)
- Belongs to `staff` (the `created_by` staffer, for audit trail)

**Design notes:**
- A null `family_id` means the discount applies to all families (e.g., a seasonal promotional rate). A non-null `family_id` means it applies to that family only
- `discount_type: 'percentage'` with `value = 100` means the plan is free (full scholarship). This is cleaner than a special-case "waived" flag
- The Fastify billing service aggregates all active discounts for a family+plan combination at invoice generation time. The result is stored as `discount_cents` on the invoice for reporting
- `valid_from` and `valid_through` allow time-bounded discounts (e.g., a first-month promotional rate). Null means no boundary on that side

---

### `processed_webhook_events`

Stripe idempotency store. Prevents duplicate processing of retried webhook events.

```sql
CREATE TABLE processed_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,  -- Stripe event ID (evt_...)
  event_type      text NOT NULL,         -- e.g. "invoice.payment_succeeded"
  processed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_stripe ON processed_webhook_events(stripe_event_id);
```

**Design notes:**
- The Stripe webhook handler checks for `stripe_event_id` before processing. If found, it returns HTTP 200 immediately without side effects
- Stripe retries webhook delivery for up to 72 hours on 5xx responses. Without this table, a transient server error causes double invoice processing, double emails, and incorrect family balances
- `event_type` is stored for debugging and auditing only — the uniqueness constraint on `stripe_event_id` is what enforces idempotency

---

## Staff

### `staff`

Studio staff members. Each staff member has a corresponding Supabase Auth user and a role injected into `app_metadata`.

```sql
CREATE TABLE staff (
  id              uuid PRIMARY KEY,  -- matches auth.users.id for this staff member
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text NOT NULL,
  role            text NOT NULL
                    CHECK (role IN ('admin', 'instructor', 'front_desk')),
  phone           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_staff_org_email ON staff(organization_id, email);
CREATE INDEX idx_staff_org ON staff(organization_id);
CREATE INDEX idx_staff_role ON staff(organization_id, role);
```

**Relationships:**
- Belongs to `organizations`
- Has many `class_instructors` (the classes they teach)
- Has many `attendance_records` (records they marked manually)
- Has many `payments` (cash/check payments they recorded)

**Design notes:**
- `id` matches the Supabase `auth.users.id` for this staff member. A join from JWT to staff profile is never needed — `auth.uid()` resolves directly. The PK has no default because it must be set explicitly to the Auth user ID at insert time
- `role` in this table is the application-level record. The authoritative role for RLS and API authorization is the `role` claim in `app_metadata` (set by the Auth Hook). The admin user management flow updates both when a role is changed to keep them in sync
- When a staff account is deactivated (`active = false`), the Fastify admin endpoint also calls `supabase.auth.admin.updateUserById(id, { ban_duration: 'none' })` to invalidate the auth session

---

### `class_instructors`

Join table between classes and their assigned instructors. A class can have a lead instructor and one or more assistants.

```sql
CREATE TABLE class_instructors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'lead'
                    CHECK (role IN ('lead', 'assistant')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_class_instructors_pair ON class_instructors(class_id, staff_id);
CREATE INDEX idx_class_instructors_staff ON class_instructors(staff_id);
CREATE INDEX idx_class_instructors_org ON class_instructors(organization_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `classes`
- Belongs to `staff`

**Design notes:**
- `role: 'lead'` is the primary instructor who owns attendance accountability for the class. `role: 'assistant'` can also mark attendance but is not responsible for the submit action
- The `class_sessions.instructor_id` field is a session-level override (substitution). When set, it supersedes the `class_instructors` lead for that session only. The override is for a single session; the class's permanent instructor assignment is unchanged

---

## Communication

### `notification_templates`

Reusable email and SMS templates with variable substitution. Admin can edit template body via the admin UI.

```sql
CREATE TABLE notification_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,     -- convention: {event}_{channel}, e.g. "enrollment_confirmation_email"
  channel         text NOT NULL CHECK (channel IN ('email', 'sms')),
  subject         text,              -- email subject line; null for SMS
  body            text NOT NULL,     -- template body with {{variable}} placeholders
  variables       jsonb NOT NULL DEFAULT '[]', -- list of expected variable names for validation
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_notification_templates_name ON notification_templates(organization_id, name);
CREATE INDEX idx_notification_templates_org ON notification_templates(organization_id);
```

**Relationships:**
- Belongs to `organizations`
- Has many `notification_log` entries

**Design notes:**
- `variables` is a jsonb array of strings documenting the expected interpolation tokens, e.g. `["student_name", "class_name", "date"]`. The Fastify notification service validates that all required variables are supplied before rendering the template body
- Template names follow the convention `{event}_{channel}` (e.g., `enrollment_confirmation_email`, `absence_alert_sms`). The notification service looks up templates by name
- Seed data provides default templates for all system-triggered notifications. Admin can edit the body per org without any schema change

---

### `notification_log`

Audit trail of every notification sent. Used for delivery status tracking and debugging.

```sql
CREATE TABLE notification_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id         uuid REFERENCES notification_templates(id),
  family_id           uuid REFERENCES families(id),
  student_id          uuid REFERENCES students(id),
  channel             text NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_address   text NOT NULL,     -- email address or E.164 phone number
  subject             text,
  body                text NOT NULL,     -- fully rendered body (variables already substituted)
  status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  provider_message_id text,             -- Resend message ID or Twilio SID
  error_message       text,             -- populated on delivery failure
  triggered_by        text,             -- event identifier, e.g. "attendance.marked_absent"
  sent_at             timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_org ON notification_log(organization_id);
CREATE INDEX idx_notification_log_family ON notification_log(family_id);
CREATE INDEX idx_notification_log_sent ON notification_log(organization_id, sent_at DESC);
CREATE INDEX idx_notification_log_status ON notification_log(organization_id, status);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `notification_templates` (nullable — broadcast messages may not use a named template)
- Belongs to `families` (nullable — system-wide announcements have no specific family)
- Belongs to `students` (nullable — not all notifications are student-specific)

**Design notes:**
- `body` stores the fully rendered notification (variables substituted). Templates change over time; the log must preserve exactly what was sent
- `provider_message_id` is the Resend `id` or Twilio `sid`. Stored for webhook callbacks: Resend sends delivery status webhooks, Twilio sends status callbacks. The Fastify webhook handler updates `status` when the callback arrives
- `triggered_by` is a free-text event identifier used for filtering in the admin notification log view (e.g., filter by `"invoice.payment_failed"` to see all payment failure SMS messages)
- This table grows unbounded. A scheduled cleanup job should archive or purge records older than 12 months

---

## Events

### `events`

Recitals, workshops, showcases, and camps. An event is a one-time occurrence with a date and venue.

```sql
CREATE TABLE events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text NOT NULL,   -- e.g. "Spring Recital 2026"
  event_type            text NOT NULL
                          CHECK (event_type IN ('recital', 'showcase', 'workshop', 'camp', 'performance', 'other')),
  description           text,
  venue                 text,            -- e.g. "Detroit Opera House"
  event_date            date NOT NULL,
  start_time            time,
  end_time              time,
  registration_deadline date,
  status                text NOT NULL DEFAULT 'upcoming'
                          CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_date ON events(organization_id, event_date);
```

**Relationships:**
- Belongs to `organizations`
- Has many `event_enrollments`
- Has many `costumes` (through `event_enrollments`)

**Design notes:**
- `event_type: 'recital'` is the primary use case — the annual recital at the Detroit Opera House. Other types support workshops and camps without schema changes
- Events do not automatically generate billing. If an event requires a fee (e.g., a recital costume deposit), a `tuition_plan` with `billing_type: 'seasonal'` is created separately and attached to the relevant enrollment

---

### `event_enrollments`

Join table between students and events. Tracks each student's participation in an event and which class they are performing with.

```sql
CREATE TABLE event_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        uuid REFERENCES classes(id), -- class they are performing with; null for individual acts
  status          text NOT NULL DEFAULT 'enrolled'
                    CHECK (status IN ('enrolled', 'waitlist', 'withdrawn')),
  notes           text,
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_event_enrollments_pair ON event_enrollments(event_id, student_id)
  WHERE status != 'withdrawn';
CREATE INDEX idx_event_enrollments_org ON event_enrollments(organization_id);
CREATE INDEX idx_event_enrollments_event ON event_enrollments(event_id);
CREATE INDEX idx_event_enrollments_student ON event_enrollments(student_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `events`
- Belongs to `students`
- Belongs to `classes` (nullable — the class they perform with at the event)
- Has many `costumes`

**Design notes:**
- `class_id` links the performance to the class the student takes. At recital, students perform in their class's act; this enables grouping by class on the recital running order view
- The unique partial index prevents double-enrollment in the same event. Withdrawn records accumulate as history, so the index excludes `'withdrawn'`
- A student performing in two acts at one recital (e.g., Ballet I and Hip Hop) gets two `event_enrollment` records — one per class/act

---

### `costumes`

Tracks costume assignment, sizing, and logistics per student per event enrollment.

```sql
CREATE TABLE costumes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_enrollment_id uuid NOT NULL REFERENCES event_enrollments(id) ON DELETE CASCADE,
  student_id          uuid NOT NULL REFERENCES students(id),
  description         text,          -- costume name/description, e.g. "Blue tutu with silver trim"
  size                text,          -- free text; sizing is vendor-specific, e.g. "CL", "AM", "AS"
  color               text,
  notes               text,
  ordered             boolean NOT NULL DEFAULT false,
  received            boolean NOT NULL DEFAULT false,
  paid                boolean NOT NULL DEFAULT false,
  ordered_at          timestamptz,
  received_at         timestamptz,
  photo_url           text,          -- Supabase Storage path for costume reference photo
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_costumes_org ON costumes(organization_id);
CREATE INDEX idx_costumes_event_enrollment ON costumes(event_enrollment_id);
CREATE INDEX idx_costumes_student ON costumes(student_id);
```

**Relationships:**
- Belongs to `organizations`
- Belongs to `event_enrollments`
- Belongs to `students`

**Design notes:**
- The three boolean flags (`ordered`, `received`, `paid`) with corresponding timestamps model the logistics pipeline that studios currently manage in spreadsheets. The admin dashboard can filter to show all costumes in a given state
- `size` is free text, not a constrained enum, because dance costume sizing is non-standard and varies by vendor. The admin enters the size code from the costume supplier's catalog
- `photo_url` points to Supabase Storage. Useful when admin is managing a large recital and needs visual confirmation of which costume belongs to which student
- One `event_enrollment` gets one `costumes` record per costume needed. A student performing in two acts gets two `event_enrollment` records and thus two costume records — one per act

---

## Entity Relationship Summary

```
organizations
  ├── families
  │     ├── students
  │     │     ├── enrollments ──────────────── classes
  │     │     ├── attendance_records ────────── class_sessions ──── classes
  │     │     ├── rfid_cards
  │     │     ├── event_enrollments ──────────── events
  │     │     └── costumes ───────────────────── event_enrollments
  │     ├── invoices
  │     │     └── payments
  │     └── discounts
  ├── classes
  │     ├── class_sessions
  │     ├── class_instructors ──── staff
  │     └── tuition_plans
  ├── staff
  ├── rfid_devices
  ├── events
  ├── notification_templates
  │     └── notification_log
  └── processed_webhook_events
```

---

## RLS Policy Reference

The following pattern is applied to every table. Role-specific policies layer on top.

```sql
-- Enable RLS on every table (FORCE catches service-role bypasses during testing)
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

-- Tenant isolation: all authenticated users see only their org's data
CREATE POLICY "tenant_isolation" ON <table>
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
  );

-- Admin full access within their org
CREATE POLICY "admin_full_access" ON <table>
  FOR ALL
  USING (
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Parent read isolation (families: own record only)
CREATE POLICY "parent_own_family" ON families
  FOR SELECT
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'family_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'parent'
  );
```

`app_metadata` (server-writable only) is used in all policies. Never reference `user_metadata` (user-writable) in RLS policies or Fastify authorization checks. A parent can modify their own `user_metadata` via the Supabase JS SDK — using it for authorization is a privilege escalation vulnerability.

---

## Migration Order

Tables must be created in dependency order. Foreign keys prevent out-of-order creation.

```
1.  organizations
2.  families
3.  staff
4.  students
5.  rfid_cards
6.  rfid_devices
7.  classes
8.  class_sessions          (depends on classes, staff)
9.  class_instructors       (depends on classes, staff)
10. tuition_plans           (depends on classes)
11. enrollments             (depends on students, classes, tuition_plans)
12. attendance_records      (depends on class_sessions, students, staff, rfid_devices)
13. invoices                (depends on families)
14. payments                (depends on families, invoices, staff)
15. discounts               (depends on families, tuition_plans, staff)
16. processed_webhook_events
17. events
18. event_enrollments       (depends on events, students, classes)
19. costumes                (depends on event_enrollments, students)
20. notification_templates
21. notification_log        (depends on notification_templates, families, students)
```

---

*Domain model defined: 2026-05-21*
