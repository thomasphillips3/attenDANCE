-- =============================================================================
-- LSODance Studio Platform — Row Level Security Policies
-- =============================================================================
--
-- SECURITY PATTERN: All policies use the subselect form:
--   (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
--
-- The subselect is REQUIRED — it caches the JWT call once per query instead
-- of evaluating it per row. Never use bare auth.jwt() outside a subselect.
--
-- Roles come from app_metadata (server-writable only via Custom Access Token
-- Hook). user_metadata is never used for authorization decisions.
--
-- =============================================================================


-- =============================================================================
-- organizations
-- Special case: no organization_id column (it IS the root).
-- Authenticated users can read org rows (needed to display studio name, etc.).
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY "org_authenticated_read" ON organizations
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);


-- =============================================================================
-- families
-- =============================================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE families FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON families
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON families
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON families
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- staff
-- =============================================================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON staff
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON staff
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON staff
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- students
-- =============================================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON students
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON students
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON students
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- classes
-- =============================================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON classes
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON classes
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON classes
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- class_instructors
-- =============================================================================

ALTER TABLE class_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_instructors FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON class_instructors
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON class_instructors
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON class_instructors
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- class_sessions
-- Instructors and front_desk staff can INSERT/UPDATE sessions.
-- =============================================================================

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON class_sessions
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON class_sessions
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk', 'instructor')
  );

CREATE POLICY "tenant_update" ON class_sessions
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk', 'instructor')
  );


-- =============================================================================
-- enrollments
-- =============================================================================

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON enrollments
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON enrollments
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON enrollments
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- attendance_records
-- All three staff roles can mark attendance (ATTN-03).
-- =============================================================================

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON attendance_records
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON attendance_records
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk', 'instructor')
  );

CREATE POLICY "tenant_update" ON attendance_records
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk', 'instructor')
  );


-- =============================================================================
-- rfid_cards
-- =============================================================================

ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_cards FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON rfid_cards
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON rfid_cards
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON rfid_cards
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- tuition_plans
-- =============================================================================

ALTER TABLE tuition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON tuition_plans
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON tuition_plans
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON tuition_plans
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- invoices
-- =============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON invoices
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON invoices
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON invoices
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- payments
-- =============================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON payments
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON payments
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- discounts
-- =============================================================================

ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON discounts
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON discounts
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON discounts
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- notification_templates
-- =============================================================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notification_templates
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON notification_templates
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON notification_templates
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- notification_log
-- =============================================================================

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON notification_log
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON notification_log
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );


-- =============================================================================
-- events
-- =============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON events
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON events
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

CREATE POLICY "tenant_update" ON events
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );


-- =============================================================================
-- event_enrollments
-- =============================================================================

ALTER TABLE event_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_enrollments FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON event_enrollments
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON event_enrollments
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON event_enrollments
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- costumes
-- =============================================================================

ALTER TABLE costumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE costumes FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON costumes
  FOR SELECT
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "tenant_insert" ON costumes
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );

CREATE POLICY "tenant_update" ON costumes
  FOR UPDATE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'front_desk')
  );


-- =============================================================================
-- processed_webhook_events
-- No organization_id — idempotency table is global.
-- Service role only (Fastify uses service role key for webhook processing).
-- No staff-accessible SELECT policy — service role bypasses RLS.
-- =============================================================================

ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhook_events FORCE ROW LEVEL SECURITY;

-- No policies: service role bypasses RLS; no staff role needs direct access.
-- The Fastify webhook handler uses SUPABASE_SERVICE_ROLE_KEY for this table only.
