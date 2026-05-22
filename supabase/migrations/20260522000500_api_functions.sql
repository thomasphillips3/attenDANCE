-- =============================================================================
-- Plan 02: API helper functions for session and roster queries
--
-- These SECURITY DEFINER functions are called from Fastify via supabase.rpc()
-- using the service role client. The organizationId parameter is always sourced
-- from the verified JWT (app_metadata), never from user-controlled input.
--
-- Using SECURITY DEFINER with explicit organization_id parameter (not relying
-- on auth.uid()) keeps the functions testable and lets the service role client
-- call them without an auth session context.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_sessions_today(p_organization_id uuid)
--
-- Returns today's class_sessions for an organization, joined with class
-- metadata and live attendance counts. Mirrors the SQL query in Plan 02
-- interfaces block exactly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sessions_today(p_organization_id uuid)
RETURNS TABLE (
  id                uuid,
  "classId"         uuid,
  "className"       text,
  "instructorName"  text,
  "startTime"       text,
  "durationMinutes" integer,
  "sessionDate"     date,
  status            text,
  "presentCount"    bigint,
  "totalEnrolled"   bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    cs.id,
    cs.class_id                               AS "classId",
    c.name                                    AS "className",
    (s.first_name || ' ' || s.last_name)      AS "instructorName",
    TO_CHAR(c.start_time, 'HH24:MI')          AS "startTime",
    c.duration_minutes                        AS "durationMinutes",
    cs.session_date                           AS "sessionDate",
    cs.status::text                           AS status,
    COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))  AS "presentCount",
    COUNT(e.id)  FILTER (WHERE e.status = 'active')               AS "totalEnrolled"
  FROM class_sessions cs
  JOIN classes c
    ON c.id = cs.class_id
   AND c.organization_id = p_organization_id
  LEFT JOIN staff s
    ON s.id = c.instructor_id
  LEFT JOIN enrollments e
    ON e.class_id = cs.class_id
   AND e.organization_id = p_organization_id
  LEFT JOIN attendance_records ar
    ON ar.class_session_id = cs.id
   AND ar.organization_id = p_organization_id
  WHERE cs.organization_id = p_organization_id
    AND cs.session_date = CURRENT_DATE
  GROUP BY cs.id, c.id, s.id
  ORDER BY c.start_time ASC;
$$;

-- Grant execute to authenticated and service_role so supabase.rpc() works
GRANT EXECUTE ON FUNCTION get_sessions_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sessions_today(uuid) TO service_role;


-- ---------------------------------------------------------------------------
-- get_session_roster(p_organization_id uuid, p_session_id uuid)
--
-- Returns all actively enrolled students for the class of a given session,
-- with their current attendance record for that session (if any).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_session_roster(p_organization_id uuid, p_session_id uuid)
RETURNS TABLE (
  "enrollmentId"     uuid,
  "studentId"        uuid,
  "firstName"        text,
  "lastName"         text,
  "attendanceId"     uuid,
  "attendanceStatus" text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    e.id           AS "enrollmentId",
    e.student_id   AS "studentId",
    st.first_name  AS "firstName",
    st.last_name   AS "lastName",
    ar.id          AS "attendanceId",
    ar.status::text AS "attendanceStatus"
  FROM enrollments e
  JOIN students st
    ON st.id = e.student_id
   AND st.organization_id = p_organization_id
  LEFT JOIN attendance_records ar
    ON ar.student_id = e.student_id
   AND ar.class_session_id = p_session_id
   AND ar.organization_id = p_organization_id
  WHERE e.organization_id = p_organization_id
    AND e.class_id = (
      SELECT class_id
      FROM class_sessions
      WHERE id = p_session_id
        AND organization_id = p_organization_id
    )
    AND e.status = 'active'
  ORDER BY st.last_name ASC, st.first_name ASC;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION get_session_roster(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_roster(uuid, uuid) TO service_role;
