---
phase: 02-studio-management
plan: 03
subsystem: api, ui
tags: [fastify, supabase, react, tanstack-query, css-grid, zod, react-hook-form, radix-dialog]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Router, AdminLayout, admin sidebar navigation, classes/staff DB tables"
provides:
  - "GET/POST/PATCH /classes endpoints with enrollment count aggregation"
  - "GET /staff endpoint for instructor picker"
  - "ClassesPage with Calendar/List toggle"
  - "WeeklyCalendar CSS Grid component (7 days x 13 hours)"
  - "ClassForm with Zod v4 validation and instructor picker"
  - "useClasses hook (list, detail, create, update)"
  - "useStaff hook for staff list"
affects: [02-04-enrollment, phase-3-billing, phase-1-attendance]

# Tech tracking
tech-stack:
  added: []
  patterns: [class-crud-route-plugin, calendar-css-grid, instructor-org-verification, zod-v4-form-validation]

key-files:
  created:
    - server/src/routes/classes.ts
    - client/src/hooks/useClasses.ts
    - client/src/hooks/useStaff.ts
    - client/src/components/admin/WeeklyCalendar.tsx
  modified:
    - server/src/types/index.ts
    - server/src/index.ts
    - client/src/screens/admin/ClassesPage.tsx
    - client/src/screens/admin/ClassForm.tsx

key-decisions:
  - "GET /staff co-located in classes.ts since it only serves the instructor picker (staff CRUD is Phase 5)"
  - "Enrollment counts use a second query + JS grouping rather than a single SQL join to avoid N+1 on the classes table"
  - "WeeklyCalendar uses grid row span (rounded to nearest hour) for MVP rather than absolute pixel positioning for sub-hour precision"

patterns-established:
  - "Admin CRUD route pattern: admin role gate + org scope + snake_case mapping for every handler"
  - "Instructor cross-org verification: always verify staff.organization_id matches before FK assignment"
  - "Form validation: Zod v4 schema with zodResolver, react-hook-form, empty-string-to-undefined conversion"

requirements-completed: [CLAS-01, CLAS-02]

# Metrics
duration: 9min
completed: 2026-05-22
---

# Phase 2 Plan 3: Class CRUD with Weekly Calendar and Instructor Picker Summary

**Fastify CRUD API for classes with enrollment counts, WeeklyCalendar CSS Grid (7x13 hours), ClassForm with Zod v4 validation and instructor picker from staff list**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-22T22:06:09Z
- **Completed:** 2026-05-22T22:15:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Complete class CRUD API (GET list with enrollment aggregation, GET detail with enrollment breakdown, POST with instructor org verification, PATCH with snake_case field mapping) plus GET /staff for instructor picker
- ClassesPage with Calendar/List toggle -- WeeklyCalendar renders class blocks on a CSS Grid with 7 day columns and 13 hour rows (7AM-7PM)
- ClassForm with all scheduling fields, Zod v4 validation, react-hook-form, instructor picker from useStaff hook, and Radix Dialog deactivation confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fastify Classes CRUD Route + Staff List Endpoint** - `14dad55` (feat)
2. **Task 2: Admin UI -- ClassesPage with WeeklyCalendar + ClassForm** - `e0068fc` (feat)

## Files Created/Modified
- `server/src/routes/classes.ts` - Fastify plugin with GET/POST/PATCH /classes and GET /staff, admin-gated and org-scoped
- `server/src/types/index.ts` - Added CreateClassBody, UpdateClassBody, ClassListQuery TypeBox schemas
- `server/src/index.ts` - Registered classesRoutes plugin
- `client/src/hooks/useClasses.ts` - TanStack Query hooks: useClasses, useClass, useCreateClass, useUpdateClass
- `client/src/hooks/useStaff.ts` - TanStack Query hook for active staff list
- `client/src/components/admin/WeeklyCalendar.tsx` - CSS Grid weekly calendar with accessible class blocks
- `client/src/screens/admin/ClassesPage.tsx` - Replaced placeholder with Calendar/List toggle view
- `client/src/screens/admin/ClassForm.tsx` - Replaced placeholder with full create/edit form

## Decisions Made
- GET /staff co-located in classes.ts rather than a separate route file, since it only serves the instructor picker and staff management is Phase 5
- Enrollment counts fetched as a second query with JS grouping (Map) rather than a complex JOIN to keep the classes query simple and avoid coupling
- WeeklyCalendar uses CSS Grid row span rounded to nearest hour for class block height -- acceptable for MVP since most dance classes are 45-60 min; sub-hour pixel precision can be added later
- Used Zod v4 API (z.union, z.coerce) with @hookform/resolvers v5.4.0 which auto-detects Zod version
- Day of week validation enforced client-side (required for recurring, optional for drop-in/workshop) with a separate server-side age range validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Class data is ready for Plan 02-04 (Enrollment Management) to build enrollment CRUD against
- WeeklyCalendar component is reusable -- future plans can import CalendarClass interface
- GET /staff endpoint is available for any future admin screen that needs staff selection

## Self-Check: PASSED

All 9 files verified present. Both task commits (14dad55, e0068fc) confirmed in git log.

---
*Phase: 02-studio-management*
*Completed: 2026-05-22*
