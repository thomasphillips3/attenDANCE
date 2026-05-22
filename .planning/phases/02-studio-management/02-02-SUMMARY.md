---
phase: 02-studio-management
plan: 02
subsystem: api, ui
tags: [fastify, supabase, react, tanstack-query, zod, react-hook-form, radix-dialog, browser-image-compression, rfid]

requires:
  - phase: 02-01
    provides: router, admin layout, placeholder screens, SQL migrations (students, families, rfid_cards tables)
  - phase: 01-attendance-mvp
    provides: auth plugin, Supabase client, session management patterns
provides:
  - CRUD API routes for students, families, and RFID cards (GET/POST/PATCH/DELETE)
  - Admin UI screens for student and family management
  - Photo upload with client-side compression to private Supabase Storage bucket
  - Debounced student search with active/inactive and class enrollment filters
  - TanStack Query hooks for students and families data fetching
  - RFID card assignment and removal on student detail
affects: [02-03, 02-04, phase-3-billing]

tech-stack:
  added: [browser-image-compression@^2.0.2]
  patterns: [admin CRUD route pattern with role gate + org scope, snake_case API response consumed directly in frontend, PhotoUpload with client-side compression + Supabase Storage signed URLs]

key-files:
  created:
    - server/src/routes/students.ts
    - server/src/routes/families.ts
    - server/src/routes/rfid-cards.ts
    - client/src/hooks/useStudents.ts
    - client/src/hooks/useFamilies.ts
    - client/src/components/admin/PhotoUpload.tsx
    - client/src/components/admin/StudentSearch.tsx
  modified:
    - server/src/index.ts
    - client/src/screens/admin/StudentsPage.tsx
    - client/src/screens/admin/StudentForm.tsx
    - client/src/screens/admin/FamiliesPage.tsx
    - client/src/screens/admin/FamilyForm.tsx
    - client/package.json

key-decisions:
  - "Snake_case API responses consumed directly in frontend TypeScript interfaces -- avoids camelCase mapping bugs and keeps types in sync with Supabase response shape"
  - "RFID card management routes separated from Phase 1 rfid checkin stub -- /rfid-cards for CRUD vs /rfid/checkin for hardware integration"
  - "Photo upload path format {org_id}/{student_id}/{timestamp}.jpg for storage RLS scoping with 1-hour signed URL expiry"
  - "Student list explicitly selects columns excluding medical_notes (T-02-10 children's data protection)"

patterns-established:
  - "Admin CRUD route pattern: every handler checks organizationId (401) then request.role === admin (403) then scopes all queries by organization_id"
  - "Family picker pattern: useFamilies() hook populates native select dropdown in StudentForm"
  - "PhotoUpload pattern: browser-image-compression -> supabase.storage.upload -> onUpload(storagePath) callback to parent form"
  - "StudentSearch pattern: controlled component with 300ms debounce, filter toggle buttons, class dropdown"

requirements-completed: [STUD-01, STUD-02, STUD-03, STUD-04, STUD-05]

duration: 16min
completed: 2026-05-22
---

# Phase 2 Plan 2: Family + Student CRUD with Photo Upload, Search/Filter, RFID Summary

**Full student/family management with admin CRUD APIs, photo upload (client-side compression to private bucket), debounced search with active/class filters, and RFID card assignment**

## Performance

- **Duration:** 16 min
- **Started:** 2026-05-22T22:05:42Z
- **Completed:** 2026-05-22T22:21:27Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Admin can create families and students linked to those families with photo, DOB, medical notes, and skill level
- Student list supports debounced name search, active/inactive toggle, and class enrollment filter with pagination
- Photo upload compresses images client-side (200KB max, 400px) before uploading to private Supabase Storage bucket with org-scoped paths and 1-hour signed URLs
- RFID card UIDs can be assigned to and removed from students with duplicate detection (409 on unique violation)
- All CRUD endpoints admin-gated and org-scoped; medical_notes excluded from list endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Fastify CRUD Routes** - `6812395` (feat)
2. **Task 2: Admin UI Screens** - `46041e1` (feat)

## Files Created/Modified
- `server/src/routes/students.ts` - GET/POST/PATCH /students with search, filters, pagination, signed photo URLs
- `server/src/routes/families.ts` - GET/POST/PATCH /families with student count
- `server/src/routes/rfid-cards.ts` - GET/POST/DELETE /rfid-cards with UNIQUE constraint handling
- `server/src/index.ts` - Register three new route plugins
- `client/src/hooks/useStudents.ts` - TanStack Query hooks: useStudents, useStudent, useCreateStudent, useUpdateStudent
- `client/src/hooks/useFamilies.ts` - TanStack Query hooks: useFamilies, useFamily, useCreateFamily, useUpdateFamily
- `client/src/components/admin/PhotoUpload.tsx` - Image compression + Supabase Storage upload with signed URL display
- `client/src/components/admin/StudentSearch.tsx` - Debounced search input + active filter buttons + class dropdown
- `client/src/screens/admin/StudentsPage.tsx` - Student list with search, filters, pagination, photo thumbnails
- `client/src/screens/admin/StudentForm.tsx` - Create/edit form with photo, family picker, RFID, deactivation dialog
- `client/src/screens/admin/FamiliesPage.tsx` - Family list with student count badges
- `client/src/screens/admin/FamilyForm.tsx` - Create/edit form with guardian/emergency fields, linked students
- `client/package.json` - Added browser-image-compression dependency

## Decisions Made
- Snake_case API responses consumed directly in frontend -- avoids mapping bugs between camelCase and snake_case
- RFID card management routes (/rfid-cards) separated from Phase 1 checkin stub (/rfid/checkin) since they serve different purposes
- Student list explicitly selects columns excluding medical_notes for children's data protection (T-02-10)
- Photo upload path includes organization_id for storage RLS scoping (T-02-08)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Model Compliance

All threat mitigations from the plan's STRIDE register were implemented:
- **T-02-05** (Elevation of Privilege): Every handler checks `request.role !== 'admin'` and returns 403
- **T-02-06** (Information Disclosure): All queries filter by `request.organizationId`; GET /students list excludes `medical_notes`
- **T-02-07** (Tampering): POST /students validates `familyId` belongs to same organization
- **T-02-08** (Tampering): Private bucket, client compression, signed URLs with 1-hour expiry, org-scoped upload paths
- **T-02-09** (Spoofing): card_uid UNIQUE constraint returns 409 on duplicate; student ownership verified
- **T-02-10** (Information Disclosure): medical_notes excluded from list endpoint
- **T-02-11** (Tampering): Search input sanitized -- `%_\\()"',` characters stripped before PostgREST filter

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Student and family data management complete -- ready for class enrollment (Plan 02-04)
- Class management (Plan 02-03) already executed -- enrollment can link students to classes
- Photo upload infrastructure in place for any future student-facing views

## Self-Check: PASSED

All 8 created files verified on disk. All 5 modified files verified on disk. Both commit hashes (6812395, 46041e1) verified in git log.

---
*Phase: 02-studio-management*
*Completed: 2026-05-22*
