-- =============================================================================
-- Events / Event Enrollments / Costumes — DELETE policies (Plan 05-04)
--
-- The base RLS policies (SELECT, INSERT, UPDATE) were created in migration
-- 000200. This migration adds the missing DELETE policies so admin-only
-- deletion is enforced at the database level.
--
-- The server uses the service-role client (bypasses RLS), but these policies
-- ensure defense-in-depth: even if a non-service-role client somehow reaches
-- the tables, only admins in the correct organization can delete rows.
-- =============================================================================

-- events: admin-only delete, scoped to organization
CREATE POLICY "events_admin_delete" ON events
  FOR DELETE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- event_enrollments: admin-only delete, scoped to organization
CREATE POLICY "event_enrollments_admin_delete" ON event_enrollments
  FOR DELETE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );

-- costumes: admin-only delete, scoped to organization
CREATE POLICY "costumes_admin_delete" ON costumes
  FOR DELETE
  USING (
    organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin')
  );
