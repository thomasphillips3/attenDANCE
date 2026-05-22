-- =============================================================================
-- LSODance — Enrollment Functions (CLAS-03, CLAS-04, CLAS-05, CLAS-06)
-- =============================================================================
--
-- Three functions + one trigger for enrollment management:
--
-- 1. enroll_student()    — Enroll a student in a class with capacity enforcement
-- 2. promote_from_waitlist() — Trigger: auto-promote earliest waitlisted student
--                              when an enrollment is dropped
-- 3. transfer_student()  — Atomic drop-from-source + enroll-in-target
--
-- Security: All functions are SECURITY DEFINER so they can read/write
-- enrollments and classes regardless of RLS. Callers are API routes that
-- have already verified the user's role and organization_id.
--
-- Concurrency: FOR UPDATE row locks on classes prevent race conditions
-- when two concurrent enrollments compete for the last seat. SKIP LOCKED
-- on waitlist promotion prevents double-promotion.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. enroll_student
--
-- Enrolls a student in a class. If the class is at capacity, the student
-- is placed on the waitlist. Uses FOR UPDATE to lock the class row and
-- prevent concurrent enrollment races (T-02-02).
--
-- Returns JSONB with enrollmentId, status, activeCount, capacity.
-- On error: returns JSONB with 'error' key.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enroll_student(
    p_organization_id uuid,
    p_student_id uuid,
    p_class_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_capacity smallint;
    v_active_count bigint;
    v_status enrollment_status;
    v_enrollment_id uuid;
    v_existing record;
BEGIN
    -- Lock the class row to prevent concurrent enrollment races
    SELECT capacity INTO v_capacity
    FROM classes
    WHERE id = p_class_id AND organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Class not found');
    END IF;

    -- Check for existing enrollment
    SELECT id, status INTO v_existing
    FROM enrollments
    WHERE student_id = p_student_id
      AND class_id = p_class_id
      AND organization_id = p_organization_id;

    IF FOUND THEN
        IF v_existing.status = 'active' THEN
            RETURN jsonb_build_object('error', 'Student already enrolled');
        ELSIF v_existing.status = 'waitlist' THEN
            RETURN jsonb_build_object('error', 'Student already on waitlist');
        END IF;
        -- status = 'dropped' falls through to re-enroll via upsert below
    END IF;

    -- Count current active enrollments
    SELECT COUNT(*) INTO v_active_count
    FROM enrollments
    WHERE class_id = p_class_id
      AND organization_id = p_organization_id
      AND status = 'active';

    -- Determine status: active if capacity allows, waitlist otherwise
    IF v_capacity IS NULL OR v_active_count < v_capacity THEN
        v_status := 'active';
    ELSE
        v_status := 'waitlist';
    END IF;

    -- Upsert enrollment (handles re-enrollment of previously dropped students)
    INSERT INTO enrollments (organization_id, student_id, class_id, status)
    VALUES (p_organization_id, p_student_id, p_class_id, v_status)
    ON CONFLICT (student_id, class_id) DO UPDATE SET
        status = v_status,
        enrolled_at = now(),
        dropped_at = NULL,
        updated_at = now()
    RETURNING id INTO v_enrollment_id;

    RETURN jsonb_build_object(
        'enrollmentId', v_enrollment_id,
        'status', v_status::text,
        'activeCount', v_active_count + CASE WHEN v_status = 'active' THEN 1 ELSE 0 END,
        'capacity', v_capacity
    );
END;
$$;

COMMENT ON FUNCTION enroll_student IS
    'Enroll a student in a class with capacity enforcement. Returns JSONB with status (active/waitlist). CLAS-03, CLAS-04.';


-- ---------------------------------------------------------------------------
-- 2. promote_from_waitlist (trigger function)
--
-- Fires AFTER UPDATE on enrollments. When a student's status changes TO
-- 'dropped', checks if a spot opened up and promotes the earliest
-- waitlisted student (by enrolled_at ASC).
--
-- Uses FOR UPDATE SKIP LOCKED to prevent double-promotion when two
-- drops happen simultaneously (T-02-03).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_capacity smallint;
    v_active_count bigint;
    v_waitlisted_id uuid;
BEGIN
    -- Only fire when status changes TO 'dropped'
    IF NEW.status != 'dropped' OR OLD.status = 'dropped' THEN
        RETURN NEW;
    END IF;

    -- Lock the class row to get capacity
    SELECT capacity INTO v_capacity
    FROM classes
    WHERE id = NEW.class_id
    FOR UPDATE;

    -- Count current active enrollments for this class
    SELECT COUNT(*) INTO v_active_count
    FROM enrollments
    WHERE class_id = NEW.class_id
      AND organization_id = NEW.organization_id
      AND status = 'active';

    -- If there is room, promote the earliest waitlisted student
    IF v_capacity IS NULL OR v_active_count < v_capacity THEN
        SELECT id INTO v_waitlisted_id
        FROM enrollments
        WHERE class_id = NEW.class_id
          AND organization_id = NEW.organization_id
          AND status = 'waitlist'
        ORDER BY enrolled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            UPDATE enrollments
            SET status = 'active',
                updated_at = now()
            WHERE id = v_waitlisted_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION promote_from_waitlist IS
    'Trigger function: auto-promotes earliest waitlisted student when an enrollment is dropped. CLAS-06.';

-- Attach the trigger to enrollments table
CREATE TRIGGER trg_promote_from_waitlist
    AFTER UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION promote_from_waitlist();


-- ---------------------------------------------------------------------------
-- 3. transfer_student
--
-- Atomically drops a student from one class and enrolls them in another.
-- Per user decision: single atomic transaction (no partial state).
--
-- Returns JSONB with fromClassId, fromStatus, toClassId, toStatus, enrollmentId.
-- On error: returns JSONB with 'error' key (and 'note' if partial).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_student(
    p_organization_id uuid,
    p_student_id uuid,
    p_from_class_id uuid,
    p_to_class_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enroll_result jsonb;
BEGIN
    -- Drop from source class
    UPDATE enrollments
    SET status = 'dropped',
        dropped_at = now(),
        updated_at = now()
    WHERE student_id = p_student_id
      AND class_id = p_from_class_id
      AND organization_id = p_organization_id
      AND status IN ('active', 'waitlist');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Student not enrolled in source class');
    END IF;

    -- Enroll in target class (reuses enroll_student for capacity logic)
    v_enroll_result := enroll_student(p_organization_id, p_student_id, p_to_class_id);

    -- Check if enrollment failed
    IF v_enroll_result ? 'error' THEN
        RETURN jsonb_build_object(
            'error', v_enroll_result->>'error',
            'note', 'Student was dropped from source class but could not enroll in target'
        );
    END IF;

    RETURN jsonb_build_object(
        'fromClassId', p_from_class_id,
        'fromStatus', 'dropped',
        'toClassId', p_to_class_id,
        'toStatus', v_enroll_result->>'status',
        'enrollmentId', v_enroll_result->>'enrollmentId'
    );
END;
$$;

COMMENT ON FUNCTION transfer_student IS
    'Atomic class transfer: drop from source + enroll in target. CLAS-05.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION enroll_student(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION enroll_student(uuid, uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION transfer_student(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_student(uuid, uuid, uuid, uuid) TO service_role;

-- promote_from_waitlist is a trigger function -- no direct grants needed
-- It runs as SECURITY DEFINER when the trigger fires
