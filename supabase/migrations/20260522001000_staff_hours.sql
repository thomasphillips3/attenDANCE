-- Migration: staff_hours table for instructor hour logging (Plan 05-03)
--
-- Instructors log hours worked per day, optionally linked to a class.
-- Admins can read all hours in their org; instructors can only manage their own.

CREATE TABLE staff_hours (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    class_id        uuid REFERENCES classes(id) ON DELETE SET NULL,
    date            date NOT NULL,
    hours           numeric(4,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_staff_hours_organization_id ON staff_hours (organization_id);
CREATE INDEX idx_staff_hours_staff_id ON staff_hours (organization_id, staff_id);
CREATE INDEX idx_staff_hours_date ON staff_hours (organization_id, date);

-- Enable RLS
ALTER TABLE staff_hours ENABLE ROW LEVEL SECURITY;

-- Instructors can read their own hours
CREATE POLICY staff_hours_instructor_select ON staff_hours FOR SELECT
    USING (
        organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND staff_id IN (
            SELECT id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Instructors can insert their own hours
CREATE POLICY staff_hours_instructor_insert ON staff_hours FOR INSERT
    WITH CHECK (
        organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND staff_id IN (
            SELECT id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Instructors can update their own hours
CREATE POLICY staff_hours_instructor_update ON staff_hours FOR UPDATE
    USING (
        organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND staff_id IN (
            SELECT id FROM staff WHERE user_id = auth.uid()
        )
    );

-- Admin can read all hours in their org
CREATE POLICY staff_hours_admin_select ON staff_hours FOR SELECT
    USING (
        organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
    );

-- Admin can manage all hours in their org (insert/update/delete)
CREATE POLICY staff_hours_admin_all ON staff_hours FOR ALL
    USING (
        organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
    );

-- Grant service role access (used by Fastify service client)
GRANT ALL ON staff_hours TO service_role;
