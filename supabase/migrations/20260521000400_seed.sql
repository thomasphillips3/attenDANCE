-- =============================================================================
-- LSODance Studio Platform — Development Seed Data
-- =============================================================================
--
-- This migration inserts seed data for local development and testing.
-- It is idempotent: the DO block exits early if the organizations table
-- already has rows, so re-running supabase db push is safe.
--
-- NOTE: Staff authentication is NOT seeded here. Staff users are created
-- via the Supabase Auth Dashboard or the Plan 05 invite flow. After creating
-- a staff user in Auth, insert a row into the staff table manually:
--
--   INSERT INTO public.staff (organization_id, user_id, first_name, last_name, email, role)
--   VALUES ('<org_id>', '<auth_user_id>', 'LaShelle', 'Johnson', 'lashelle@lsodance.com', 'admin');
--
-- =============================================================================

DO $$
DECLARE
  v_org_id        uuid;
  v_family_id     uuid;
  v_hiphop_id     uuid;
  v_ballet_id     uuid;
  v_tap_id        uuid;
  v_session_hiphop_id uuid;
  v_session_ballet_id uuid;
  v_session_tap_id    uuid;

  -- Student IDs for Hip Hop Intermediate roster (from screens.jsx HIP_HOP_ROSTER)
  v_s1  uuid; v_s2  uuid; v_s3  uuid; v_s4  uuid; v_s5  uuid;
  v_s6  uuid; v_s7  uuid; v_s8  uuid; v_s9  uuid; v_s10 uuid;
BEGIN
  -- Exit early if seed data already exists
  IF EXISTS (SELECT 1 FROM public.organizations LIMIT 1) THEN
    RAISE NOTICE 'Seed data already present — skipping.';
    RETURN;
  END IF;

  -- -----------------------------------------------------------------------
  -- 1. organizations
  -- -----------------------------------------------------------------------
  v_org_id := gen_random_uuid();
  INSERT INTO public.organizations (id, name, city, state, settings)
  VALUES (
    v_org_id,
    'LaShelle School of Dance',
    'Oak Park',
    'MI',
    '{"timezone": "America/Detroit"}'::jsonb
  );

  -- -----------------------------------------------------------------------
  -- 2. families
  -- Placeholder family for seed students. Real family records created via
  -- the enrollment flow in Phase 3.
  -- -----------------------------------------------------------------------
  v_family_id := gen_random_uuid();
  INSERT INTO public.families (id, organization_id, primary_guardian_name, email)
  VALUES (
    v_family_id,
    v_org_id,
    'Seed Family (Development)',
    'seed-family@lsodance.dev'
  );

  -- -----------------------------------------------------------------------
  -- 3. classes
  -- Three Saturday classes matching the screens.jsx visual reference.
  -- day_of_week: 6 = Saturday (0=Sunday through 6=Saturday per schema).
  -- -----------------------------------------------------------------------
  v_hiphop_id := gen_random_uuid();
  INSERT INTO public.classes (id, organization_id, name, type, day_of_week, start_time, duration_minutes, capacity, level)
  VALUES (
    v_hiphop_id,
    v_org_id,
    'Hip Hop Intermediate',
    'recurring',
    6,
    '12:30:00',
    60,
    20,
    'Intermediate'
  );

  v_ballet_id := gen_random_uuid();
  INSERT INTO public.classes (id, organization_id, name, type, day_of_week, start_time, duration_minutes, capacity, level)
  VALUES (
    v_ballet_id,
    v_org_id,
    'Ballet I',
    'recurring',
    6,
    '10:00:00',
    60,
    15,
    'Beginner'
  );

  v_tap_id := gen_random_uuid();
  INSERT INTO public.classes (id, organization_id, name, type, day_of_week, start_time, duration_minutes, capacity, level)
  VALUES (
    v_tap_id,
    v_org_id,
    'Tap Foundations',
    'recurring',
    6,
    '11:00:00',
    45,
    12,
    'Beginner'
  );

  -- -----------------------------------------------------------------------
  -- 4. class_sessions
  -- One session per class for today (CURRENT_DATE).
  -- -----------------------------------------------------------------------
  v_session_hiphop_id := gen_random_uuid();
  INSERT INTO public.class_sessions (id, organization_id, class_id, session_date, status)
  VALUES (v_session_hiphop_id, v_org_id, v_hiphop_id, CURRENT_DATE, 'scheduled');

  v_session_ballet_id := gen_random_uuid();
  INSERT INTO public.class_sessions (id, organization_id, class_id, session_date, status)
  VALUES (v_session_ballet_id, v_org_id, v_ballet_id, CURRENT_DATE, 'scheduled');

  v_session_tap_id := gen_random_uuid();
  INSERT INTO public.class_sessions (id, organization_id, class_id, session_date, status)
  VALUES (v_session_tap_id, v_org_id, v_tap_id, CURRENT_DATE, 'scheduled');

  -- -----------------------------------------------------------------------
  -- 5. students
  -- Ten students from the Hip Hop Intermediate roster in screens.jsx.
  -- Names: Amara Johnson, Zaria Thompson, Imani Williams, Kennedi Brooks,
  --         Nyla Patterson, Jasmine Carter, Aaliyah Davis, Sanaa Mitchell,
  --         Layla Harris, Aniyah Robinson
  -- -----------------------------------------------------------------------
  v_s1 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s1, v_org_id, v_family_id, 'Amara', 'Johnson');

  v_s2 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s2, v_org_id, v_family_id, 'Zaria', 'Thompson');

  v_s3 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s3, v_org_id, v_family_id, 'Imani', 'Williams');

  v_s4 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s4, v_org_id, v_family_id, 'Kennedi', 'Brooks');

  v_s5 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s5, v_org_id, v_family_id, 'Nyla', 'Patterson');

  v_s6 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s6, v_org_id, v_family_id, 'Jasmine', 'Carter');

  v_s7 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s7, v_org_id, v_family_id, 'Aaliyah', 'Davis');

  v_s8 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s8, v_org_id, v_family_id, 'Sanaa', 'Mitchell');

  v_s9 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s9, v_org_id, v_family_id, 'Layla', 'Harris');

  v_s10 := gen_random_uuid();
  INSERT INTO public.students (id, organization_id, family_id, first_name, last_name)
  VALUES (v_s10, v_org_id, v_family_id, 'Aniyah', 'Robinson');

  -- -----------------------------------------------------------------------
  -- 6. enrollments
  -- All ten students enrolled in Hip Hop Intermediate with status = active.
  -- -----------------------------------------------------------------------
  INSERT INTO public.enrollments (id, organization_id, student_id, class_id, status)
  VALUES
    (gen_random_uuid(), v_org_id, v_s1,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s2,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s3,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s4,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s5,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s6,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s7,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s8,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s9,  v_hiphop_id, 'active'),
    (gen_random_uuid(), v_org_id, v_s10, v_hiphop_id, 'active');

  RAISE NOTICE 'Seed data inserted successfully for organization: LaShelle School of Dance (%)', v_org_id;
END;
$$;
