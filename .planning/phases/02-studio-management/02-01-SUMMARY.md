---
phase: 02-studio-management
plan: 01
subsystem: ui, database
tags: [react-router-dom, routing, layouts, admin-sidebar, enrollment-functions, supabase-storage, rls, plpgsql]

# Dependency graph
requires:
  - phase: 01-attendance-mvp
    provides: "Auth system (useAuth hook, JWT claims), ClassList/Roster screens, Zustand store, Supabase schema with enrollments table"
provides:
  - "react-router-dom v7 with createBrowserRouter dual-layout route structure"
  - "FrontDeskLayout (auth-gated wrapper for attendance flow)"
  - "AdminLayout (auth + admin role gate via JWT app_metadata)"
  - "AdminSidebar with 5 nav items (2 active, 3 grayed)"
  - "7 lazy-loaded admin placeholder screens"
  - "enroll_student() Postgres function with capacity enforcement and row locking"
  - "promote_from_waitlist() trigger with SKIP LOCKED concurrency safety"
  - "transfer_student() atomic class transfer function"
  - "Private student-photos storage bucket with org-scoped RLS"
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN]

# Tech tracking
tech-stack:
  added: [react-router-dom@7]
  patterns:
    - "Dual-layout routing: FrontDeskLayout (/) + AdminLayout (/admin)"
    - "Admin role gate via JWT app_metadata decode (atob, not user_metadata)"
    - "Lazy-loaded admin screens via React.lazy + Suspense"
    - "SECURITY DEFINER + FOR UPDATE row locking for enrollment concurrency"
    - "Organization-scoped storage RLS via folder path convention"

key-files:
  created:
    - client/src/router.tsx
    - client/src/layouts/FrontDeskLayout.tsx
    - client/src/layouts/AdminLayout.tsx
    - client/src/components/admin/AdminSidebar.tsx
    - client/src/screens/admin/StudentsPage.tsx
    - client/src/screens/admin/StudentForm.tsx
    - client/src/screens/admin/FamiliesPage.tsx
    - client/src/screens/admin/FamilyForm.tsx
    - client/src/screens/admin/ClassesPage.tsx
    - client/src/screens/admin/ClassForm.tsx
    - client/src/screens/admin/ClassDetail.tsx
    - supabase/migrations/20260522000600_enrollment_functions.sql
    - supabase/migrations/20260522000700_storage_bucket.sql
  modified:
    - client/src/App.tsx
    - client/src/main.tsx
    - client/src/store.ts
    - client/src/screens/ClassList.tsx
    - client/src/screens/Roster.tsx
    - client/package.json

key-decisions:
  - "Roster uses default export (not named) to match React.lazy dynamic import pattern"
  - "All hooks called before conditional guard return in Roster to satisfy React rules of hooks"
  - "Storage RLS uses subselect pattern per STATE.md decision for auth.jwt() organization_id"

patterns-established:
  - "Admin role check: atob(session.access_token.split('.')[1]) -> app_metadata.role"
  - "Lazy admin screen pattern: React.lazy(() => import('./screens/admin/XxxPage')) wrapped in Suspense"
  - "Enrollment capacity: FOR UPDATE on classes row, then COUNT active, then INSERT/upsert"
  - "Storage path convention: {org_id}/{student_id}/{timestamp}.ext for org-scoped RLS"

requirements-completed: [STUD-01, STUD-03, CLAS-03, CLAS-04, CLAS-05, CLAS-06]

# Metrics
duration: 13min
completed: 2026-05-22
---

# Phase 2 Plan 1: Router + Admin Shell + SQL Migrations Summary

**Dual-layout routing with react-router-dom v7, admin sidebar shell, and enrollment DB functions with capacity enforcement and waitlist auto-promotion**

## Performance

- **Duration:** 13 min
- **Started:** 2026-05-22T21:46:56Z
- **Completed:** 2026-05-22T21:59:58Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Installed react-router-dom v7 and migrated Phase 1 screen-switching from Zustand state to URL routing without regressions
- Built AdminLayout with JWT role gate and AdminSidebar with 5 nav items (Students/Classes active, Dashboard/Attendance/Reports grayed as "Coming soon")
- Created three enrollment Postgres functions (enroll_student, promote_from_waitlist trigger, transfer_student) with row-level locking for concurrency safety
- Created private student-photos storage bucket with organization-scoped RLS for children's data protection
- Both migrations applied to Supabase (lzqsgwjgtpdcvosvpexr)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-router-dom, Create Router + Layouts, Migrate Screen Navigation** - `7cc4924` (feat)
2. **Task 2: SQL Migrations -- Enrollment Functions + Private Storage Bucket** - `c628642` (feat)

## Files Created/Modified

- `client/src/router.tsx` - Route tree with createBrowserRouter: /, /admin, /login with lazy-loaded admin screens
- `client/src/layouts/FrontDeskLayout.tsx` - Auth-gated wrapper for front desk flow with OfflineBanner
- `client/src/layouts/AdminLayout.tsx` - Auth + admin role gate with JWT decode, renders sidebar + Outlet
- `client/src/components/admin/AdminSidebar.tsx` - 240px sidebar with 5 nav items, logotype, user info, sign out
- `client/src/screens/admin/*.tsx` - 7 placeholder screens for lazy loading (StudentsPage, StudentForm, FamiliesPage, FamilyForm, ClassesPage, ClassForm, ClassDetail)
- `client/src/App.tsx` - Stripped to queryClient export only (AppContent removed)
- `client/src/main.tsx` - Now renders QueryClientProvider + RouterProvider instead of App
- `client/src/store.ts` - Removed selectedSessionId/setSelectedSessionId (router handles navigation)
- `client/src/screens/ClassList.tsx` - useNavigate replaces setSelectedSessionId
- `client/src/screens/Roster.tsx` - Default export, useParams for sessionId, useNavigate for back
- `supabase/migrations/20260522000600_enrollment_functions.sql` - enroll_student, promote_from_waitlist trigger, transfer_student
- `supabase/migrations/20260522000700_storage_bucket.sql` - Private student-photos bucket with org-scoped RLS

## Decisions Made

- Roster changed to default export to match React.lazy's dynamic import requirement (lazy import expects default export)
- All hooks called before the sessionId guard in Roster to satisfy React's rules of hooks (conditional returns after hooks, not before)
- Storage RLS policies use the subselect pattern `(SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id'))` per the STATE.md decision about avoiding per-row re-evaluation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React hooks-after-conditional-return in Roster**
- **Found during:** Task 1 (Roster migration)
- **Issue:** Initial implementation placed useRoster, useSessions, useAuth, and useStore hooks after an early return (`if (!sessionId) return <Navigate ...>`), violating React's rules of hooks
- **Fix:** Moved all hooks before the guard, passing `sessionId ?? ''` to useRoster. Guard now returns after all hooks are called.
- **Files modified:** client/src/screens/Roster.tsx
- **Verification:** TypeScript compiles cleanly (`npx tsc --noEmit` zero errors)
- **Committed in:** 7cc4924 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for React correctness. No scope creep.

## Known Stubs

- `client/src/screens/admin/StudentsPage.tsx` - Static placeholder text "Students", will be replaced in Plan 02-02
- `client/src/screens/admin/StudentForm.tsx` - Static placeholder text "Student Form", will be replaced in Plan 02-02
- `client/src/screens/admin/FamiliesPage.tsx` - Static placeholder text "Families", will be replaced in Plan 02-02
- `client/src/screens/admin/FamilyForm.tsx` - Static placeholder text "Family Form", will be replaced in Plan 02-02
- `client/src/screens/admin/ClassesPage.tsx` - Static placeholder text "Classes", will be replaced in Plan 02-03
- `client/src/screens/admin/ClassForm.tsx` - Static placeholder text "Class Form", will be replaced in Plan 02-03
- `client/src/screens/admin/ClassDetail.tsx` - Static placeholder text "Class Detail", will be replaced in Plan 02-03

These stubs are intentional scaffolding for lazy-loaded routes. Each will be replaced by its respective plan (02-02 for students/families, 02-03 for classes). The plan's goal (routing + admin shell + DB functions) is fully achieved despite these stubs.

## Issues Encountered

None.

## User Setup Required

None - migrations were applied automatically via `supabase db push`.

## Next Phase Readiness

- Router structure ready for Plans 02-02 (Student CRUD), 02-03 (Class CRUD), 02-04 (Enrollment API)
- Admin placeholder screens in place for lazy-loaded replacement
- Enrollment DB functions ready for API routes in Plan 02-04
- Student-photos bucket ready for photo upload feature in Plan 02-02

---
*Phase: 02-studio-management*
*Plan: 01*
*Completed: 2026-05-22*

## Self-Check: PASSED

- All 14 created files verified present on disk
- Both task commits (7cc4924, c628642) verified in git log
- TypeScript compilation: zero errors
