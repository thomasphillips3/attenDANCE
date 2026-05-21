-- =============================================================================
-- LSODance Studio Platform — Supabase/Postgres Schema
-- =============================================================================
--
-- Design decisions:
--
-- 1. MULTI-TENANCY (INFR-01): organization_id is on every table. Even though
--    we launch for a single studio, adding it later would require painful
--    backfills and RLS rewrites. Cost now: near-zero. Cost later: high.
--
-- 2. RLS (INFR-02): Row Level Security is enabled on every table. Policies use
--    auth.jwt() -> 'organization_id' to scope every query to the tenant. Staff
--    roles live in Supabase Auth app_metadata so they travel with the JWT
--    without an extra DB round-trip.
--
-- 3. auth.users FK: staff.user_id references auth.users(id). This is the
--    Supabase-recommended pattern — keep identity in Auth, domain data here.
--    Parents (PORT-01 through PORT-04) authenticate the same way; they get a
--    families.stripe_customer_id and a 'parent' role added to app_metadata.
--
-- 4. ENUM types are defined up front. Postgres enums are efficient and
--    self-documenting, but adding values later requires ALTER TYPE ... ADD VALUE
--    (non-transactional in older Postgres). The set defined here covers all
--    v1 requirements; extend carefully.
--
-- 5. class_instructors is a separate join table (not a direct FK on classes)
--    to support effective-from/until dating. An instructor may sub for one
--    session while another is on leave — the history is preserved.
--
-- 6. discounts has nullable family_id and class_id so a discount can target:
--    a specific family, a specific class, or a family+class combination.
--    Check constraints ensure at least one is set.
--
-- 7. processed_webhook_events (BILL-08): Stripe can deliver a webhook more than
--    once. This table provides idempotency via a unique index on stripe_event_id.
--    Insert-on-conflict-do-nothing in the handler guards against duplicate runs.
--
-- 8. Timestamps are timestamptz (UTC). The application layer converts to the
--    studio's local timezone (America/Detroit) for display.
--
-- 9. Indexes are created on organization_id for every table (RLS filter),
--    plus columns that appear in likely JOIN / WHERE conditions identified
--    from the requirements (student lookups, session dates, card UIDs).
--
-- =============================================================================


-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Class scheduling type (CLAS-01)
CREATE TYPE class_type AS ENUM ('recurring', 'drop_in', 'workshop');

-- Session lifecycle (ATTN-01 status display)
CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Enrollment states including waitlist (CLAS-04, CLAS-06)
CREATE TYPE enrollment_status AS ENUM ('active', 'waitlist', 'dropped');

-- Attendance outcomes per student per session (ATTN-03)
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- How the attendance record was created (ATTN-09, ATTN-08)
CREATE TYPE marked_by_source AS ENUM ('manual', 'rfid');

-- Tuition billing cadence (BILL-01)
CREATE TYPE billing_interval AS ENUM ('monthly', 'per_session', 'seasonal');

-- Invoice lifecycle (BILL-05, BILL-07)
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'waived');

-- Payment method (BILL-06)
CREATE TYPE payment_method AS ENUM ('stripe', 'cash', 'check');

-- Discount category (BILL-04)
CREATE TYPE discount_type AS ENUM ('sibling', 'scholarship', 'staff');

-- Staff access level (AUTH-04)
CREATE TYPE staff_role AS ENUM ('admin', 'instructor', 'front_desk');

-- Notification channel (COMM-01 through COMM-07)
CREATE TYPE notification_channel AS ENUM ('email', 'sms');

-- Delivery lifecycle for notification_log (COMM-08)
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- Event category (EVNT-01)
CREATE TYPE event_type AS ENUM ('recital', 'showcase', 'workshop', 'camp');


-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- The root tenant. Even with a single studio launch, every row everywhere
-- carries organization_id so RLS policies are uniform from day one.
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text        NOT NULL,
    address             text,
    city                text,
    state               char(2),
    zip                 varchar(10),
    phone               varchar(20),
    email               text,
    stripe_account_id   text,                               -- Stripe Connect account for future marketplace
    settings            jsonb       NOT NULL DEFAULT '{}',  -- flexible tenant-level config (timezone, branding, etc.)
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN organizations.settings IS
    'Tenant config blob: e.g. {"timezone":"America/Detroit","logo_url":"...","sms_enabled":true}';

-- ---------------------------------------------------------------------------
-- families
-- A household unit. Multiple students can belong to one family.
-- Parents authenticate via Supabase Auth; the Auth user_id is not stored here
-- because one family account may be shared by two guardians. The email here
-- is the primary contact for billing and notifications (not necessarily the
-- Auth login email, though they are usually the same).
-- ---------------------------------------------------------------------------
CREATE TABLE families (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_guardian_name       text        NOT NULL,
    secondary_guardian_name     text,
    email                       text        NOT NULL,
    phone                       varchar(20),
    emergency_contact_name      text,
    emergency_contact_phone     varchar(20),
    address                     text,
    stripe_customer_id          text,   -- Stripe Customer object (PORT-02, BILL-03)
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_families_organization_id ON families (organization_id);
CREATE INDEX idx_families_email           ON families (organization_id, email);

-- ---------------------------------------------------------------------------
-- staff
-- Studio employees. Linked to Supabase Auth via user_id. Role is also stored
-- in auth.users.app_metadata so the JWT carries it — the role column here is
-- the source of truth; a trigger or edge function should keep app_metadata
-- in sync when role changes.
-- ---------------------------------------------------------------------------
CREATE TABLE staff (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name      text        NOT NULL,
    last_name       text        NOT NULL,
    email           text        NOT NULL,
    role            staff_role  NOT NULL DEFAULT 'front_desk',
    active          boolean     NOT NULL DEFAULT true,
    hourly_rate     numeric(10,2),  -- STAF-03 hour logging
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (organization_id, user_id),
    UNIQUE (organization_id, email)
);

CREATE INDEX idx_staff_organization_id ON staff (organization_id);
CREATE INDEX idx_staff_user_id         ON staff (user_id);

COMMENT ON COLUMN staff.role IS
    'Synced to auth.users.app_metadata["role"] so JWT carries role without extra DB query.';

-- ---------------------------------------------------------------------------
-- students
-- Individual dancers. Belong to a family. RFID cards linked via rfid_cards.
-- ---------------------------------------------------------------------------
CREATE TABLE students (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    family_id       uuid        NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
    first_name      text        NOT NULL,
    last_name       text        NOT NULL,
    dob             date,
    photo_url       text,       -- Supabase Storage URL
    active          boolean     NOT NULL DEFAULT true,
    medical_notes   text,       -- STUD-01: visible to instructor on roster
    skill_level     text,       -- free-text for now; structured in v2 ADVN-01
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_organization_id ON students (organization_id);
CREATE INDEX idx_students_family_id       ON students (organization_id, family_id);
CREATE INDEX idx_students_active          ON students (organization_id, active);

-- ---------------------------------------------------------------------------
-- classes
-- The class template (schedule definition). Actual meeting instances are in
-- class_sessions. instructor_id is a denormalized convenience FK for the
-- primary/current instructor; the full assignment history is in class_instructors.
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
    id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             text            NOT NULL,
    type             class_type      NOT NULL DEFAULT 'recurring',
    instructor_id    uuid            REFERENCES staff(id) ON DELETE SET NULL,  -- current primary instructor
    day_of_week      smallint        CHECK (day_of_week BETWEEN 0 AND 6),       -- 0=Sunday, 6=Saturday
    start_time       time            NOT NULL,
    duration_minutes smallint        NOT NULL CHECK (duration_minutes > 0),
    room             text,
    capacity         smallint        CHECK (capacity > 0),
    age_min          smallint        CHECK (age_min >= 0),
    age_max          smallint        CHECK (age_max >= 0),
    level            text,           -- e.g. "Beginner", "Intermediate", "Advanced"
    active           boolean         NOT NULL DEFAULT true,
    created_at       timestamptz     NOT NULL DEFAULT now(),
    updated_at       timestamptz     NOT NULL DEFAULT now(),

    CHECK (age_max IS NULL OR age_min IS NULL OR age_max >= age_min)
);

CREATE INDEX idx_classes_organization_id ON classes (organization_id);
CREATE INDEX idx_classes_instructor_id   ON classes (organization_id, instructor_id);
CREATE INDEX idx_classes_day_of_week     ON classes (organization_id, day_of_week) WHERE active = true;

COMMENT ON COLUMN classes.day_of_week IS '0=Sunday through 6=Saturday. NULL for drop-in or workshop types.';
COMMENT ON COLUMN classes.instructor_id IS
    'Denormalized current instructor for fast display. Full history is in class_instructors.';

-- ---------------------------------------------------------------------------
-- class_instructors
-- Full assignment history for audit and substitute tracking (STAF-01).
-- effective_until NULL means currently assigned.
-- ---------------------------------------------------------------------------
CREATE TABLE class_instructors (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id        uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    class_id        uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    effective_from  date        NOT NULL,
    effective_until date,       -- NULL = currently active
    created_at      timestamptz NOT NULL DEFAULT now(),

    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_class_instructors_organization_id ON class_instructors (organization_id);
CREATE INDEX idx_class_instructors_class_id        ON class_instructors (class_id);
CREATE INDEX idx_class_instructors_staff_id        ON class_instructors (staff_id);

-- ---------------------------------------------------------------------------
-- class_sessions
-- One row per scheduled class meeting. Generated from the classes template
-- (recurring) or created individually (drop_in/workshop). Attendance is
-- recorded against these rows (ATTN-03).
-- ---------------------------------------------------------------------------
CREATE TABLE class_sessions (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id        uuid            NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_date    date            NOT NULL,
    status          session_status  NOT NULL DEFAULT 'scheduled',
    created_at      timestamptz     NOT NULL DEFAULT now(),

    UNIQUE (class_id, session_date)
);

CREATE INDEX idx_class_sessions_organization_id ON class_sessions (organization_id);
CREATE INDEX idx_class_sessions_class_id        ON class_sessions (class_id);
CREATE INDEX idx_class_sessions_date            ON class_sessions (organization_id, session_date);

COMMENT ON TABLE class_sessions IS
    'One row per class meeting. ATTN-01 shows sessions where session_date = today.';

-- ---------------------------------------------------------------------------
-- enrollments
-- Student <-> class membership. Waitlist is managed here (CLAS-04, CLAS-06).
-- On drop, set status = dropped and record dropped_at for audit.
-- ---------------------------------------------------------------------------
CREATE TABLE enrollments (
    id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id      uuid                NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        uuid                NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status          enrollment_status   NOT NULL DEFAULT 'active',
    enrolled_at     timestamptz         NOT NULL DEFAULT now(),
    dropped_at      timestamptz,
    created_at      timestamptz         NOT NULL DEFAULT now(),
    updated_at      timestamptz         NOT NULL DEFAULT now(),

    UNIQUE (student_id, class_id)   -- one enrollment record per student per class; status tracks state
);

CREATE INDEX idx_enrollments_organization_id ON enrollments (organization_id);
CREATE INDEX idx_enrollments_student_id      ON enrollments (organization_id, student_id);
CREATE INDEX idx_enrollments_class_id        ON enrollments (organization_id, class_id);
CREATE INDEX idx_enrollments_status          ON enrollments (organization_id, class_id, status);

COMMENT ON COLUMN enrollments.status IS
    'active = enrolled; waitlist = capacity full (CLAS-04); dropped = left class (CLAS-05).';

-- ---------------------------------------------------------------------------
-- attendance_records
-- One row per student per session. Supports both manual iPad tap (ATTN-03)
-- and RFID scan (ATTN-08, ATTN-09).
-- ---------------------------------------------------------------------------
CREATE TABLE attendance_records (
    id                  uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id          uuid                NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_session_id    uuid                NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    status              attendance_status   NOT NULL,
    marked_by           marked_by_source    NOT NULL DEFAULT 'manual',
    marked_by_staff_id  uuid                REFERENCES staff(id) ON DELETE SET NULL,  -- NULL if marked by RFID
    notes               text,
    created_at          timestamptz         NOT NULL DEFAULT now(),
    updated_at          timestamptz         NOT NULL DEFAULT now(),

    UNIQUE (student_id, class_session_id)  -- one record per student per session; update to change status
);

CREATE INDEX idx_attendance_organization_id    ON attendance_records (organization_id);
CREATE INDEX idx_attendance_class_session_id   ON attendance_records (organization_id, class_session_id);
CREATE INDEX idx_attendance_student_id         ON attendance_records (organization_id, student_id);
CREATE INDEX idx_attendance_marked_by          ON attendance_records (organization_id, marked_by);

COMMENT ON COLUMN attendance_records.marked_by_staff_id IS
    'NULL when marked_by = rfid. The RFID endpoint identifies the student via rfid_cards, not a staff login.';

-- ---------------------------------------------------------------------------
-- rfid_cards
-- Maps physical card UIDs to students (STUD-04, ATTN-08).
-- card_uid is globally unique — a card cannot belong to two studios.
-- ---------------------------------------------------------------------------
CREATE TABLE rfid_cards (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id      uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    card_uid        varchar(64) NOT NULL UNIQUE,  -- hex UID from RC522/PN532 reader
    issued_at       timestamptz NOT NULL DEFAULT now(),
    active          boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfid_cards_organization_id ON rfid_cards (organization_id);
CREATE INDEX idx_rfid_cards_student_id      ON rfid_cards (student_id);
CREATE INDEX idx_rfid_cards_card_uid        ON rfid_cards (card_uid) WHERE active = true;

COMMENT ON COLUMN rfid_cards.card_uid IS
    'Hardware UID from NFC card. Globally unique — POST /rfid/checkin looks this up first.';


-- =============================================================================
-- BILLING TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tuition_plans
-- Pricing definition per class. One class can have multiple plans
-- (e.g. monthly recurring and a drop-in rate). Stripe Price ID links to the
-- corresponding Stripe price object for subscription creation (BILL-01).
-- ---------------------------------------------------------------------------
CREATE TABLE tuition_plans (
    id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid                NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id        uuid                REFERENCES classes(id) ON DELETE SET NULL,  -- NULL = studio-wide plan
    amount          numeric(10,2)       NOT NULL CHECK (amount >= 0),
    interval        billing_interval    NOT NULL,
    stripe_price_id text,   -- populated after Stripe Price object is created
    active          boolean             NOT NULL DEFAULT true,
    created_at      timestamptz         NOT NULL DEFAULT now(),
    updated_at      timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX idx_tuition_plans_organization_id ON tuition_plans (organization_id);
CREATE INDEX idx_tuition_plans_class_id        ON tuition_plans (organization_id, class_id);

-- ---------------------------------------------------------------------------
-- invoices
-- One invoice per billing cycle per family. Generated automatically by the
-- billing engine (BILL-02). Stripe Invoice ID populated when charged via
-- Stripe (BILL-03). Cash/check invoices have stripe_invoice_id = NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    family_id           uuid            NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
    amount              numeric(10,2)   NOT NULL CHECK (amount >= 0),
    status              invoice_status  NOT NULL DEFAULT 'pending',
    due_date            date            NOT NULL,
    stripe_invoice_id   text,   -- NULL for cash/check; also NULL until Stripe invoice is created
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_organization_id ON invoices (organization_id);
CREATE INDEX idx_invoices_family_id       ON invoices (organization_id, family_id);
CREATE INDEX idx_invoices_status          ON invoices (organization_id, status);
CREATE INDEX idx_invoices_due_date        ON invoices (organization_id, due_date);

-- ---------------------------------------------------------------------------
-- payments
-- Ledger of received payments. A payment satisfies an invoice (BILL-05, BILL-06).
-- Stripe payments carry stripe_payment_intent_id for webhook reconciliation.
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
    id                          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id             uuid            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id                  uuid            NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount                      numeric(10,2)   NOT NULL CHECK (amount > 0),
    method                      payment_method  NOT NULL,
    paid_at                     timestamptz     NOT NULL DEFAULT now(),
    stripe_payment_intent_id    text,   -- NULL for cash/check
    notes                       text,   -- e.g. "check #1042"
    created_at                  timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_organization_id ON payments (organization_id);
CREATE INDEX idx_payments_invoice_id      ON payments (organization_id, invoice_id);
CREATE INDEX idx_payments_paid_at         ON payments (organization_id, paid_at);

-- ---------------------------------------------------------------------------
-- discounts
-- Applied to a family, a class, or a family+class combination (BILL-04).
-- Exactly one of amount or percent must be non-null (check constraint below).
-- family_id and class_id are both nullable: NULL means "applies to all".
-- ---------------------------------------------------------------------------
CREATE TABLE discounts (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    family_id       uuid            REFERENCES families(id) ON DELETE CASCADE,   -- NULL = applies to class regardless of family
    class_id        uuid            REFERENCES classes(id) ON DELETE CASCADE,    -- NULL = applies to family across all classes
    type            discount_type   NOT NULL,
    amount          numeric(10,2)   CHECK (amount > 0),   -- flat dollar amount
    percent         smallint        CHECK (percent BETWEEN 1 AND 100),
    active          boolean         NOT NULL DEFAULT true,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),

    -- Must be either flat amount OR percent, not both and not neither
    CHECK (
        (amount IS NOT NULL AND percent IS NULL) OR
        (amount IS NULL AND percent IS NOT NULL)
    ),
    -- At least one of family_id or class_id must be set (no org-wide catch-alls here)
    CHECK (family_id IS NOT NULL OR class_id IS NOT NULL)
);

CREATE INDEX idx_discounts_organization_id ON discounts (organization_id);
CREATE INDEX idx_discounts_family_id       ON discounts (organization_id, family_id);
CREATE INDEX idx_discounts_class_id        ON discounts (organization_id, class_id);


-- =============================================================================
-- COMMUNICATION TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notification_templates
-- Reusable email/SMS templates (COMM-06, COMM-07). Body supports simple
-- variable interpolation tokens (e.g. {{student_name}}, {{due_date}}).
-- ---------------------------------------------------------------------------
CREATE TABLE notification_templates (
    id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid                    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text                    NOT NULL,
    type            notification_channel    NOT NULL,
    subject         text,                   -- NULL for SMS (no subject)
    body            text                    NOT NULL,
    created_at      timestamptz             NOT NULL DEFAULT now(),
    updated_at      timestamptz             NOT NULL DEFAULT now(),

    UNIQUE (organization_id, name, type)
);

CREATE INDEX idx_notification_templates_organization_id ON notification_templates (organization_id);

COMMENT ON COLUMN notification_templates.body IS
    'Supports {{token}} interpolation. For email: HTML or plain text. For SMS: plain text, keep under 160 chars.';

-- ---------------------------------------------------------------------------
-- notification_log
-- Immutable delivery record for every outbound notification (COMM-08).
-- sent_at is the timestamp of the API call to Resend/Twilio. delivery_status
-- is updated via webhooks from those providers.
-- ---------------------------------------------------------------------------
CREATE TABLE notification_log (
    id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid                    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    family_id       uuid                    REFERENCES families(id) ON DELETE SET NULL,
    student_id      uuid                    REFERENCES students(id) ON DELETE SET NULL,
    type            notification_channel    NOT NULL,
    template_id     uuid                    REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient       text                    NOT NULL,   -- email address or E.164 phone number
    subject         text,                               -- NULL for SMS
    sent_at         timestamptz             NOT NULL DEFAULT now(),
    delivery_status delivery_status         NOT NULL DEFAULT 'pending',
    created_at      timestamptz             NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_organization_id ON notification_log (organization_id);
CREATE INDEX idx_notification_log_family_id       ON notification_log (organization_id, family_id);
CREATE INDEX idx_notification_log_student_id      ON notification_log (organization_id, student_id);
CREATE INDEX idx_notification_log_sent_at         ON notification_log (organization_id, sent_at);
CREATE INDEX idx_notification_log_status          ON notification_log (organization_id, delivery_status);


-- =============================================================================
-- EVENTS AND RECITAL TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- events
-- Recitals, showcases, workshops, and camps (EVNT-01).
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            text        NOT NULL,
    event_date      date        NOT NULL,
    venue           text,
    type            event_type  NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_organization_id ON events (organization_id);
CREATE INDEX idx_events_event_date      ON events (organization_id, event_date);

-- ---------------------------------------------------------------------------
-- event_enrollments
-- Which students are participating in which event (EVNT-02).
-- ---------------------------------------------------------------------------
CREATE TABLE event_enrollments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id      uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    enrolled_at     timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (student_id, event_id)
);

CREATE INDEX idx_event_enrollments_organization_id ON event_enrollments (organization_id);
CREATE INDEX idx_event_enrollments_event_id        ON event_enrollments (organization_id, event_id);
CREATE INDEX idx_event_enrollments_student_id      ON event_enrollments (organization_id, student_id);

-- ---------------------------------------------------------------------------
-- costumes
-- Per-student, per-event costume tracking (EVNT-03). The three boolean
-- columns (ordered, received, paid) give Mrs. Goodman a quick checklist
-- status for each student at recital time.
-- ---------------------------------------------------------------------------
CREATE TABLE costumes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id      uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id        uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    description     text,
    size            text,
    ordered         boolean     NOT NULL DEFAULT false,
    received        boolean     NOT NULL DEFAULT false,
    paid            boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_costumes_organization_id ON costumes (organization_id);
CREATE INDEX idx_costumes_event_id        ON costumes (organization_id, event_id);
CREATE INDEX idx_costumes_student_id      ON costumes (organization_id, student_id);


-- =============================================================================
-- WEBHOOK IDEMPOTENCY (BILL-08)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- processed_webhook_events
-- Guards against duplicate Stripe webhook delivery. The backend handler does:
--   INSERT INTO processed_webhook_events (stripe_event_id, event_type)
--   VALUES ($1, $2)
--   ON CONFLICT (stripe_event_id) DO NOTHING
-- then checks rows-affected. If 0, the event was already handled — return 200
-- immediately without re-processing.
-- ---------------------------------------------------------------------------
CREATE TABLE processed_webhook_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id varchar(64) NOT NULL UNIQUE,
    event_type      text        NOT NULL,   -- e.g. 'invoice.payment_succeeded'
    processed_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE processed_webhook_events IS
    'Idempotency guard for Stripe webhooks. Insert-on-conflict-do-nothing; check rows affected before processing.';


-- =============================================================================
-- UPDATED_AT TRIGGER
-- Postgres does not auto-update updated_at. This trigger function is applied
-- to every table that has an updated_at column.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_families_updated_at
    BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enrollments_updated_at
    BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tuition_plans_updated_at
    BEFORE UPDATE ON tuition_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discounts_updated_at
    BEFORE UPDATE ON discounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_costumes_updated_at
    BEFORE UPDATE ON costumes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
--
-- Policy design:
--
-- Every table enables RLS. The core tenant isolation predicate is:
--   organization_id = (auth.jwt() ->> 'organization_id')::uuid
--
-- This requires the Supabase Auth JWT to carry organization_id in its claims.
-- Set this via a Postgres function hook (auth.uid() custom claims) or via the
-- Supabase "Custom Claims" pattern: store organization_id in
-- auth.users.raw_app_meta_data and expose it through a claims function.
--
-- Role-based restrictions layer on top:
--   auth.jwt() ->> 'role'  (stored in app_metadata)
--
-- Public tables (organizations): accessible to authenticated users who belong
-- to that organization.
--
-- Staff-only tables (staff, classes, tuition_plans, discounts, etc.): require
-- role IN ('admin', 'instructor', 'front_desk') — i.e. any authenticated staff.
--
-- Admin-only mutations (organizations.settings, staff INSERT/DELETE): require
-- role = 'admin'.
--
-- Parent access (families, students, invoices, payments, attendance_records):
-- parents should only see their own family's data. Implement via a separate
-- policy checking auth.uid() = ... when the parent portal is built (Phase 4).
-- These stubs use staff-access policies as placeholders — tighten in Phase 4.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_own_org"
    ON organizations FOR SELECT
    USING (id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_update_own_org"
    ON organizations FOR UPDATE
    USING (
        id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_families"
    ON families FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_families"
    ON families FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_update_families"
    ON families FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_staff"
    ON staff FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_insert_staff"
    ON staff FOR INSERT
    WITH CHECK (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

CREATE POLICY "admins_can_update_staff"
    ON staff FOR UPDATE
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_students"
    ON students FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_students"
    ON students FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_update_students"
    ON students FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_classes"
    ON classes FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_classes"
    ON classes FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- class_instructors
-- ---------------------------------------------------------------------------
ALTER TABLE class_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_class_instructors"
    ON class_instructors FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_class_instructors"
    ON class_instructors FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- class_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_class_sessions"
    ON class_sessions FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_class_sessions"
    ON class_sessions FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_enrollments"
    ON enrollments FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_manage_enrollments"
    ON enrollments FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- attendance_records
-- ---------------------------------------------------------------------------
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_attendance"
    ON attendance_records FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_attendance"
    ON attendance_records FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_update_attendance"
    ON attendance_records FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- rfid_cards
-- ---------------------------------------------------------------------------
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_rfid_cards"
    ON rfid_cards FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_rfid_cards"
    ON rfid_cards FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- tuition_plans
-- ---------------------------------------------------------------------------
ALTER TABLE tuition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_tuition_plans"
    ON tuition_plans FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_tuition_plans"
    ON tuition_plans FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_invoices"
    ON invoices FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_invoices"
    ON invoices FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_update_invoices"
    ON invoices FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_payments"
    ON payments FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_payments"
    ON payments FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_discounts"
    ON discounts FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_discounts"
    ON discounts FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- notification_templates
-- ---------------------------------------------------------------------------
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_notification_templates"
    ON notification_templates FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_notification_templates"
    ON notification_templates FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- notification_log
-- ---------------------------------------------------------------------------
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_notification_log"
    ON notification_log FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_insert_notification_log"
    ON notification_log FOR INSERT
    WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_update_notification_log"
    ON notification_log FOR UPDATE
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_events"
    ON events FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "admins_can_manage_events"
    ON events FOR ALL
    USING (
        organization_id = (auth.jwt() ->> 'organization_id')::uuid
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- ---------------------------------------------------------------------------
-- event_enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE event_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_event_enrollments"
    ON event_enrollments FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_manage_event_enrollments"
    ON event_enrollments FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- costumes
-- ---------------------------------------------------------------------------
ALTER TABLE costumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_costumes"
    ON costumes FOR SELECT
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "staff_can_manage_costumes"
    ON costumes FOR ALL
    USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- ---------------------------------------------------------------------------
-- processed_webhook_events
-- RLS is enabled but the Stripe webhook handler runs via a service-role key
-- (bypasses RLS). The policy here is a belt-and-suspenders guard — no
-- authenticated user role should be inserting webhook events.
-- ---------------------------------------------------------------------------
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE processed_webhook_events IS
    'RLS enabled. Access is via service-role key from the Fastify webhook handler only — no user-facing policies needed.';


-- =============================================================================
-- PHASE 4 NOTE: PARENT PORTAL RLS
-- =============================================================================
--
-- When building the parent portal (PORT-01 through PORT-04), add:
--
-- 1. A families.auth_user_id uuid column (or a lookup via families.email
--    matching auth.users.email) to link a parent's Auth session to their family.
--
-- 2. Replace the broad staff_can_read policies on families, students,
--    invoices, payments, and attendance_records with split policies:
--
--    -- Staff read
--    CREATE POLICY "staff_can_read_families"
--        ON families FOR SELECT
--        USING (
--            organization_id = (auth.jwt() ->> 'organization_id')::uuid
--            AND (auth.jwt() ->> 'role') IN ('admin','instructor','front_desk')
--        );
--
--    -- Parent read own family only
--    CREATE POLICY "parents_can_read_own_family"
--        ON families FOR SELECT
--        USING (auth_user_id = auth.uid());
--
-- 3. Add corresponding parent-scoped policies on students, invoices, payments,
--    and attendance_records filtering by family_id.
--
-- =============================================================================

-- End of SCHEMA.sql
