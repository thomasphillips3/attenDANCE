# Phase 2: Studio Management -- Plan Verification

**Phase:** 02-studio-management
**Plans verified:** 4 (02-01, 02-02, 02-03, 02-04)
**Status:** ISSUES FOUND
**Issues:** 2 blocker(s), 2 warning(s)

---

## Dimension 1: Requirement Coverage

| Requirement | Description | Plans | Tasks | Status |
|-------------|-------------|-------|-------|--------|
| STUD-01 | Create, edit, deactivate student records | 02-01, 02-02 | 02-02 T1 (API), 02-02 T2 (UI) | COVERED |
| STUD-02 | Create and edit family records | 02-02 | 02-02 T1 (API), 02-02 T2 (UI) | COVERED |
| STUD-03 | Students belong to a family; families can have multiple students | 02-01, 02-02 | 02-02 T1 (family picker validation), 02-02 T2 (family picker UI) | COVERED |
| STUD-04 | Admin can assign RFID card UID to a student | 02-02 | 02-02 T1 (rfid-cards route), 02-02 T2 (RFID section in StudentForm) | COVERED |
| STUD-05 | Search and filter students by name, **class**, active status | 02-02 | 02-02 T1 (API), 02-02 T2 (StudentSearch) | **PARTIAL** |
| CLAS-01 | Create and edit classes with scheduling details | 02-03 | 02-03 T1 (API), 02-03 T2 (ClassForm) | COVERED |
| CLAS-02 | Visual weekly calendar of all classes | 02-03 | 02-03 T2 (WeeklyCalendar component) | COVERED |
| CLAS-03 | Admin can enroll students in classes | 02-01, 02-04 | 02-01 T2 (DB function), 02-04 T1 (API), 02-04 T2 (EnrollmentModal) | COVERED |
| CLAS-04 | System enforces capacity limits and waitlist | 02-01, 02-04 | 02-01 T2 (enroll_student with FOR UPDATE), 02-04 T1 (POST /enrollments), 02-04 T2 (capacity bar + warning) | COVERED |
| CLAS-05 | Admin can drop or transfer students | 02-01, 02-04 | 02-01 T2 (transfer_student function), 02-04 T1 (DELETE + POST /transfer), 02-04 T2 (Drop/Transfer dialogs) | COVERED |
| CLAS-06 | System auto-promotes from waitlist | 02-01 | 02-01 T2 (promote_from_waitlist trigger) | COVERED |

**STUD-05 gap:** The requirement says "search and filter students by name, **class**, and active status." Plan 02-02 implements search by name and filter by active status, but **filtering by class is missing**. The StudentListQuery TypeBox schema has `search`, `active`, `page`, `limit` -- no `classId` parameter. The StudentSearch component has search input + active/inactive toggle -- no class filter dropdown. The GET /students API endpoint only supports name search and active filter.

**Result:** 10/11 requirements fully covered. 1 partially covered (STUD-05 missing class filter).

## Dimension 2: Task Completeness

| Plan | Task | Name | Files | Action | Verify | Done | Status |
|------|------|------|-------|--------|--------|------|--------|
| 02-01 | T1 | Router + Layouts + Migration | Yes | Yes (specific) | Yes (`tsc --noEmit`) | Yes (10 items) | Valid |
| 02-01 | T2 | SQL Migrations | Yes | Yes (detailed SQL) | Yes (grep) | Yes (3 items) | Valid |
| 02-02 | T1 | Fastify CRUD Routes | Yes | Yes (specific) | Yes (`tsc --noEmit`) | Yes (7 items) | Valid |
| 02-02 | T2 | Admin UI Screens | Yes | Yes (detailed) | Yes (`tsc --noEmit`) | Yes (9 items) | Valid |
| 02-03 | T1 | Fastify Classes CRUD | Yes | Yes (specific) | Yes (`tsc --noEmit`) | Yes (7 items) | Valid |
| 02-03 | T2 | Admin UI Classes + Calendar | Yes | Yes (detailed) | Yes (`tsc --noEmit`) | Yes (11 items) | Valid |
| 02-04 | T1 | Fastify Enrollment Routes | Yes | Yes (specific) | Yes (`tsc --noEmit`) | Yes (6 items) | Valid |
| 02-04 | T2 | ClassDetail + EnrollmentModal | Yes | Yes (detailed) | Yes (`tsc --noEmit`) | Yes (9 items) | Valid |
| 02-04 | T3 | Human Checkpoint | N/A (checkpoint) | N/A | N/A | N/A | Valid |

All tasks have required fields. Actions are specific with file paths, function names, styling details, and wiring instructions. Verify commands use TypeScript compilation checks. Done criteria are measurable.

**Note on verify commands:** All auto tasks use `tsc --noEmit` as the automated verify. This confirms type-correctness but not runtime behavior. For a CRUD phase with extensive UI work, this is acceptable because the human checkpoint in Task 3 of Plan 02-04 provides runtime verification. However, Plan 02-01 Task 2 uses a grep-based verify (counting function definitions and bucket references) which is a weaker signal -- it confirms file content exists but not SQL correctness. Acceptable given the SQL will be tested during the human checkpoint.

**Result:** PASS

## Dimension 3: Dependency Correctness

| Plan | Wave | depends_on | Valid | Notes |
|------|------|------------|-------|-------|
| 02-01 | 1 | [] | Yes | Foundation -- no deps |
| 02-02 | 2 | [02-01] | Yes | Needs router + placeholders from 02-01 |
| 02-03 | 2 | [02-01] | Yes | Needs router + placeholders from 02-01 |
| 02-04 | 3 | [02-02, 02-03] | Yes | Needs student/family API (02-02) + class API (02-03) |

- No cycles detected.
- All referenced plans exist.
- Wave numbers are consistent: Wave 1 (no deps) -> Wave 2 (depends on 01) -> Wave 3 (depends on 02+03).
- 02-04 correctly waits for both 02-02 and 02-03 since ClassDetail uses useClass (from 02-03) and EnrollmentModal uses useStudents (from 02-02).

**Same-wave file conflict:** Plans 02-02 and 02-03 both modify `server/src/index.ts` and `server/src/types/index.ts` in Wave 2. Both plans add route registrations to index.ts and TypeBox schemas to types/index.ts. These are **append-only** operations (adding new imports + register calls, adding new schema definitions). The changes target different sections of the files: 02-02 adds student/family/rfid-card route imports, 02-03 adds class route imports. Since both are appending to the end of the file, the risk is a merge conflict at the same insertion point, not conflicting logic.

**Result:** PASS with WARNING on same-wave file overlap (see Issues).

## Dimension 4: Key Links Planned

| From | To | Via | Plan | Status |
|------|----|----|------|--------|
| main.tsx | router.tsx | RouterProvider | 02-01 | Wired (explicit in action) |
| AdminLayout | AdminSidebar | Import + render | 02-01 | Wired |
| FrontDeskLayout | ClassList/Roster | Outlet | 02-01 | Wired |
| StudentsPage | /students API | useStudents hook | 02-02 | Wired |
| StudentForm | /students API | useMutation | 02-02 | Wired |
| PhotoUpload | Supabase Storage | supabase.storage.upload | 02-02 | Wired (org path) |
| Students API | Supabase Storage | createSignedUrl | 02-02 | Wired |
| ClassesPage | /classes API | useClasses hook | 02-03 | Wired |
| WeeklyCalendar | ClassesPage | Props (classes array) | 02-03 | Wired |
| ClassForm | /staff API | useStaff hook | 02-03 | Wired |
| Enrollments API | enroll_student() | supabase.rpc | 02-04 | Wired |
| Enrollments API | transfer_student() | supabase.rpc | 02-04 | Wired |
| ClassDetail | EnrollmentModal | State-controlled open | 02-04 | Wired |
| ClassDetail | /classes/:id + /enrollments | useClass + useEnrollments | 02-04 | Wired |

All critical data paths have explicit wiring in task actions. No isolated artifacts.

**Result:** PASS

## Dimension 5: Scope Sanity

| Plan | Tasks | Files | Assessment |
|------|-------|-------|------------|
| 02-01 | 2 | 11 | Tasks OK. Files at WARNING threshold -- 11 files modified, but Task 1 is a large refactor (9 files) touching router, layouts, store, and existing screens. This is one atomic operation (router migration) that cannot be split without leaving the app in a broken state. Acceptable. |
| 02-02 | 2 | 13 | Tasks OK. Files **above** warning threshold (13 files) -- 5 server files + 8 client files. Task 2 alone touches 8 files (4 screens + 2 hooks + 2 components). This is a dense plan but the files are straightforward CRUD screens. The alternative (splitting into 3 plans) adds coordination overhead without improving quality. Acceptable for CRUD work. |
| 02-03 | 2 | 8 | Within all thresholds. Well-scoped. |
| 02-04 | 3 (2 auto + 1 checkpoint) | 7 | Within all thresholds. Includes the final human checkpoint. |

No plan exceeds the 5-task blocker threshold. File counts are elevated in Plans 01 and 02 but justified by the nature of the work (router migration is atomic; CRUD screens follow repetitive patterns).

**Result:** PASS

## Dimension 6: Verification Derivation (must_haves)

**Plan 02-01 truths:** User-observable ("Front desk flow works identically," "Admin can navigate to /admin and sees sidebar," "Non-admin users are redirected") plus DB-verifiable ("enroll_student() exists," "student-photos bucket exists"). The DB truths are infrastructure for later plans, not directly user-observable, but they are testable and map to specific artifacts. Acceptable.

**Plan 02-02 truths:** All user-observable ("Admin can create a student," "Admin can search students," "Non-admin users get 403"). Well-derived.

**Plan 02-03 truths:** All user-observable ("Admin can create a class," "Admin can view weekly calendar"). Well-derived.

**Plan 02-04 truths:** All user-observable ("Admin can enroll," "System enforces capacity," "System auto-promotes"). Well-derived from phase success criteria.

Artifacts map to truths across all plans. Key links connect dependent artifacts.

**Result:** PASS

## Dimension 7: Context Compliance

No CONTEXT.md file exists for this phase. However, the user provided 4 decisions in the verification prompt. Checking those against plan implementation:

| Decision | Plan Implementation | Status |
|----------|-------------------|--------|
| D1: Photo bucket PRIVATE with org-scoped storage RLS | 02-01 T2: `public=false`, storage RLS policies scope by `organization_id` in folder path. 02-02 T2: PhotoUpload embeds org_id in upload path. | COMPLIANT |
| D2: Sidebar shows all 5 items, grayed-out for unbuilt | 02-01 T1: AdminSidebar shows all 5 items, Dashboard/Attendance/Reports are styled spans with opacity 0.4, cursor not-allowed, title="Coming soon" | COMPLIANT |
| D3: Class transfer is ATOMIC single transaction | 02-01 T2: transfer_student() is a single PL/pgSQL function. 02-04 T1: POST /enrollments/transfer calls this function via RPC. | COMPLIANT |
| D4: Children's data security (medical_notes excluded from list, search sanitized, photo paths include org_id) | 02-02 T1: GET /students list uses explicit column selection excluding medical_notes; search input sanitized by stripping special chars; photo upload path convention `{org_id}/{student_id}/{timestamp}.jpg`. | COMPLIANT |

**Result:** PASS

## Dimension 7b: Scope Reduction Detection

Scanned all plan task actions for scope reduction language ("v1", "v2", "simplified", "static for now", "hardcoded", "future enhancement", "placeholder", "basic version", "minimal", "stub", "skip for now").

- Plan 02-01 creates placeholder admin screens (`StudentsPage.tsx`, `ClassForm.tsx`, etc.) that return a div with the page name. These are explicitly noted as temporary files "to be replaced in Plans 02-02, 02-03, 02-04." This is a valid scaffolding pattern, not scope reduction -- the real implementations follow in subsequent same-phase plans.
- No other scope reduction language found in any plan.

**Result:** PASS

## Dimension 7c: Architectural Tier Compliance

RESEARCH.md contains an Architectural Responsibility Map. Cross-referencing:

| Capability | Map Tier | Plan Tier | Status |
|------------|----------|-----------|--------|
| Student/Family CRUD | API / Backend | 02-02 T1: Fastify routes | COMPLIANT |
| Enrollment capacity enforcement | API / Backend + Database | 02-01 T2: PL/pgSQL function; 02-04 T1: Fastify route | COMPLIANT |
| Waitlist auto-promote | Database (trigger) | 02-01 T2: Postgres AFTER UPDATE trigger | COMPLIANT |
| Photo upload | Frontend (compress) + Supabase Storage | 02-02 T2: browser-image-compression client-side + supabase.storage.upload | COMPLIANT |
| Weekly calendar view | Browser / Client | 02-03 T2: React component | COMPLIANT |
| Search/filter students | Browser / Client | 02-02 T1: API-side search + 02-02 T2: client UI | NOTE |
| Role-based navigation | Browser / Client + API | 02-01 T1: AdminLayout JWT check; all API routes check role | COMPLIANT |
| RFID card assignment | API / Backend | 02-02 T1: rfid-cards route | COMPLIANT |

**NOTE on Search:** The responsibility map says "client-side filtering at 75-150 scale." Plan 02-02 implements server-side search via the API (ILIKE query). This is actually a more robust approach that works at any scale, and the research explicitly says "server-side search API as future-proof." Not a tier violation.

**Result:** PASS

## Dimension 8: Nyquist Compliance

SKIPPED (nyquist_validation disabled in config.json)

## Dimension 9: Cross-Plan Data Contracts

Identified shared data entities across plans:

1. **students table** -- Written by 02-02 (CRUD), read by 02-04 (enrollment modal student search). Plan 02-02 creates the API; Plan 02-04 uses `useStudents` hook from 02-02. No transform conflict -- 02-04 reads student data as-is.

2. **classes table** -- Written by 02-03 (CRUD), read by 02-04 (ClassDetail + transfer dialog). Plan 02-04 uses `useClass` and `useClasses` hooks from 02-03. No transform conflict.

3. **enrollments table** -- DB functions created in 02-01, API routes in 02-04, displayed in 02-04 (ClassDetail). The enroll_student() function returns jsonb; the API route passes this through. No conflicting transforms.

4. **server/src/index.ts** -- Plans 02-02 and 02-03 both append route registrations. Plans 02-04 also appends. Append-only changes to different named routes -- no data contract conflict, but potential merge conflict (see Dimension 3 warning).

5. **server/src/types/index.ts** -- Same pattern: all plans append new TypeBox schemas. No naming conflicts (each plan adds schemas for different resources).

**Result:** PASS

## Dimension 10: CLAUDE.md Compliance

Checked project CLAUDE.md against plans:

- **Tech stack**: Plans use Fastify 5, Supabase, Vite + React + TypeScript + Tailwind, as specified. COMPLIANT.
- **Accessibility**: Plans specify 18px+ body text, 56px+ tap targets, Atkinson Hyperlegible font, high contrast throughout. COMPLIANT.
- **Multi-tenancy**: All API routes filter by organization_id from JWT. All DB functions take p_organization_id. Storage paths include organization_id. COMPLIANT.
- **Offline**: Not in scope for Phase 2 (attendance offline was Phase 1). No conflict.
- **Conventional commits**: Plans don't specify commit messages (execution concern). No conflict.

**Result:** PASS

## Dimension 11: Research Resolution

RESEARCH.md has `## Open Questions` section at line 823 **without** `(RESOLVED)` suffix. Three questions listed:
1. Photo storage bucket visibility -- Resolved by user decision #1 (PRIVATE)
2. Admin sidebar navigation items -- Resolved by user decision #2 (all 5 items)
3. Transfer as single operation -- Resolved by user decision #3 (ATOMIC)

All three questions are resolved by user decisions, and the plans implement the decisions correctly. However, the RESEARCH.md section heading was not updated to `(RESOLVED)`.

**Result:** WARNING (heading not updated, but substantively resolved)

## Dimension 12: Pattern Compliance

SKIPPED (no PATTERNS.md found for this phase)

---

## Issues

### Blockers (must fix)

**1. [requirement_coverage] STUD-05 missing "filter by class" capability**

```yaml
issue:
  plan: "02-02"
  dimension: requirement_coverage
  severity: blocker
  description: "STUD-05 requires 'search and filter students by name, class, active status.' Plan 02-02 implements search by name and filter by active status, but filtering by class (showing only students enrolled in a specific class) is missing from the API (no classId query param in StudentListQuery), the hook (useStudents filters), and the UI (StudentSearch component)."
  task: 1
  fix_hint: "Add classId (optional string format uuid) to the StudentListQuery TypeBox schema. In the GET /students handler, when classId is provided, join or subquery on enrollments table: .in('id', enrollments subquery WHERE class_id = classId AND status = 'active'). Add a class filter dropdown to StudentSearch populated from useClasses(). Pass classId into useStudents hook filters."
```

**2. [research_resolution] Open Questions section not marked as resolved**

```yaml
issue:
  plan: null
  dimension: research_resolution
  severity: blocker
  description: "RESEARCH.md ## Open Questions section header does not have (RESOLVED) suffix. All 3 questions are substantively resolved by user decisions and correctly implemented in plans, but the RESEARCH.md heading should reflect this to satisfy the research resolution gate."
  fix_hint: "Update the RESEARCH.md heading to '## Open Questions (RESOLVED)' and add inline resolution markers referencing user decisions: 'RESOLVED: PRIVATE bucket per user decision', 'RESOLVED: All 5 items per user decision', 'RESOLVED: Atomic per user decision'."
```

### Warnings (should fix)

**3. [dependency_correctness] Same-wave file overlap between Plans 02-02 and 02-03**

```yaml
issue:
  plan: "02-02, 02-03"
  dimension: dependency_correctness
  severity: warning
  description: "Plans 02-02 and 02-03 both run in Wave 2 and both modify server/src/index.ts (adding route registrations) and server/src/types/index.ts (adding TypeBox schemas). Both changes are append-only to different sections, so the risk is a merge conflict at the insertion point rather than conflicting logic. If these plans execute sequentially in the same agent session, the second plan will see the first plan's changes and append correctly. If parallel execution is used, the second writer may not see the first writer's additions."
  fix_hint: "If executor runs plans sequentially within Wave 2 (02-02 then 02-03 or vice versa), no fix needed -- second plan will see first plan's appended content. If parallel execution is planned, add a note to both plans that server/src/index.ts and server/src/types/index.ts are shared files and the second executor should check for additions from the other plan before appending."
```

**4. [task_completeness] Plan 02-01 Task 1 modifies 9 files in a single task**

```yaml
issue:
  plan: "02-01"
  dimension: scope_sanity
  severity: warning
  description: "Task 1 of Plan 02-01 modifies 9 files: router.tsx, FrontDeskLayout.tsx, AdminLayout.tsx, AdminSidebar.tsx, App.tsx, main.tsx, ClassList.tsx, Roster.tsx, store.ts. This is a large atomic change (router migration). The action is detailed and specific, so the executor has clear instructions, but 9 files in one task increases the risk of partial failure mid-task."
  task: 1
  fix_hint: "Acceptable as-is because the router migration is genuinely atomic -- splitting it would leave the app in a broken state between tasks. The executor should treat this as a single commit. No action required unless the executor encounters issues."
```

---

## Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| STUD-01 | 02-01, 02-02 | Covered |
| STUD-02 | 02-02 | Covered |
| STUD-03 | 02-01, 02-02 | Covered |
| STUD-04 | 02-02 | Covered |
| STUD-05 | 02-02 | **PARTIAL -- missing class filter** |
| CLAS-01 | 02-03 | Covered |
| CLAS-02 | 02-03 | Covered |
| CLAS-03 | 02-01, 02-04 | Covered |
| CLAS-04 | 02-01, 02-04 | Covered |
| CLAS-05 | 02-01, 02-04 | Covered |
| CLAS-06 | 02-01 | Covered |

## Plan Summary

| Plan | Tasks | Files | Wave | Status |
|------|-------|-------|------|--------|
| 02-01 | 2 | 11 | 1 | Valid (warning on task scope) |
| 02-02 | 2 | 13 | 2 | BLOCKER (STUD-05 incomplete) |
| 02-03 | 2 | 8 | 2 | Valid |
| 02-04 | 3 | 7 | 3 | Valid |

## Success Criteria Trace

| Success Criterion | Covering Plans | Status |
|-------------------|---------------|--------|
| SC1: Create student with all fields, link to family with guardians | 02-02 (T1 + T2) | Covered |
| SC2: Search and filter students by name, class, active status | 02-02 (T1 + T2) | **PARTIAL** (class filter missing) |
| SC3: Create class with full scheduling details, view on weekly calendar | 02-03 (T1 + T2) | Covered |
| SC4: Enroll, capacity enforcement, waitlist, auto-promote, transfer | 02-01 (T2) + 02-04 (T1 + T2 + T3) | Covered |

## Recommendation

2 blocker(s) require revision before execution:

1. **STUD-05 class filter** -- Add class-based filtering to Plan 02-02's StudentListQuery schema, GET /students handler, StudentSearch component, and useStudents hook. This is a moderate addition (one more query param, one join/subquery, one dropdown) that fits within Plan 02-02's existing scope.

2. **RESEARCH.md Open Questions** -- Update section heading to `(RESOLVED)` and add inline resolution markers. This is a 30-second documentation fix.

Returning to planner with feedback.
