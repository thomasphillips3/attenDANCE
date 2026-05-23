---
phase: 05-admin-dashboard
plan: 03
subsystem: api, ui
tags: [fastify, react, supabase, rls, instructor-portal, attendance, hours-tracking]

requires:
  - phase: 01-attendance-mvp
    provides: attendance_records table, roster UI, class_sessions
  - phase: 02-studio-management
    provides: staff table with hourly_rate, classes, enrollments, class_instructors
  - phase: 05-admin-dashboard
    provides: dashboard infrastructure, admin layout patterns

provides:
  - Instructor portal with auth-gated layout at /instructor
  - GET /staff/me/schedule endpoint (instructor's assigned classes)
  - GET /staff/me/sessions endpoint (today's sessions with attendance)
  - POST /staff/hours endpoint (log hours worked)
  - GET /staff/me/hours endpoint (hour history with pay calculation)
  - staff_hours table with RLS policies
  - InstructorDashboard, InstructorSchedule, InstructorHours screens

affects: [admin-reports, payroll]

tech-stack:
  added: []
  patterns:
    - "Instructor self-service endpoints under /staff/me/* scoped by staff.user_id lookup"
    - "staff_hours table with instructor self-manage RLS + admin org-wide read"
    - "InstructorLayout mirrors ParentLayout pattern: JWT role decode, role-specific redirect"

key-files:
  created:
    - server/src/routes/staff.ts
    - supabase/migrations/20260522001000_staff_hours.sql
    - client/src/layouts/InstructorLayout.tsx
    - client/src/screens/staff/InstructorDashboard.tsx
    - client/src/screens/staff/InstructorSchedule.tsx
    - client/src/screens/staff/InstructorHours.tsx
  modified:
    - server/src/index.ts
    - client/src/router.tsx

key-decisions:
  - "Staff API plugin named 'staff-portal' to avoid conflict with GET /staff in classes.ts"
  - "Instructor staff record resolved via user_id lookup on each request (not cached)"
  - "Hours endpoint returns calculated pay inline (total_hours * hourly_rate)"

patterns-established:
  - "Instructor /staff/me/* pattern: resolve staff record from auth user_id, then scope all queries"
  - "Role-specific portal layout: decode JWT app_metadata role, redirect non-matching roles"

requirements-completed: [STAF-01, STAF-02, STAF-03]

duration: 11min
completed: 2026-05-22
---

# Phase 5 Plan 3: Staff/Instructor Portal Summary

**Instructor portal with schedule view, attendance marking links, and hour logging with pay calculation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-23T01:55:09Z
- **Completed:** 2026-05-23T02:06:09Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Instructor-scoped API endpoints for schedule, sessions, hours with role gating
- staff_hours table with RLS policies (instructor self-manage + admin read)
- Full instructor portal UI: today's classes dashboard, weekly schedule, hour logging with pay totals

## Task Commits

Each task was committed atomically:

1. **Task 1: Staff API endpoints** - `eaf1203` (feat)
2. **Task 2: Staff hours migration** - `171d6e2` (feat)
3. **Task 3: Instructor portal UI** - `0071044` (feat)

## Files Created/Modified
- `server/src/routes/staff.ts` - Instructor-scoped API: schedule, sessions, hours CRUD
- `server/src/index.ts` - Register staff-portal plugin
- `supabase/migrations/20260522001000_staff_hours.sql` - staff_hours table + RLS
- `client/src/layouts/InstructorLayout.tsx` - Auth-gated layout with purple header and tab nav
- `client/src/screens/staff/InstructorDashboard.tsx` - Today's sessions with mark attendance links
- `client/src/screens/staff/InstructorSchedule.tsx` - Weekly schedule grouped by day of week
- `client/src/screens/staff/InstructorHours.tsx` - Hour logging form + history table + pay totals
- `client/src/router.tsx` - Added /instructor routes with lazy loading

## Decisions Made
- Named the Fastify plugin 'staff-portal' to avoid route registration conflict with the existing GET /staff endpoint in classes.ts (used for the admin instructor picker dropdown)
- Instructor staff record is resolved via user_id lookup from request.user.id on each request rather than caching, keeping the pattern stateless and consistent with how parent portal resolves family_id
- Hours response includes calculated pay inline (total_hours * hourly_rate) to avoid requiring the frontend to fetch staff details separately
- InstructorLayout follows the same JWT app_metadata role-decode pattern as ParentLayout for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. The staff_hours migration needs to be applied via `npx supabase db push`.

## Next Phase Readiness
- Instructor portal is functional: instructors can view schedule, navigate to roster for attendance, and log hours
- Admin reports (Plan 05-02) can now include staff hours data for payroll reporting
- The staff_hours table is ready for admin-side hour review and payroll export features

## Self-Check: PASSED

All 7 created files verified on disk. All 3 task commits verified in git log.

---
*Phase: 05-admin-dashboard*
*Completed: 2026-05-22*
