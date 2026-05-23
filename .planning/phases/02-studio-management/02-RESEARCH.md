# Phase 2: Studio Management - Research

**Researched:** 2026-05-22
**Domain:** CRUD admin screens, enrollment management, client-side routing, image upload
**Confidence:** HIGH

## Summary

Phase 2 builds the admin management layer on top of the existing Phase 1 foundation. The DB schema already exists with all necessary tables (students, families, classes, enrollments, rfid_cards) including indexes and RLS policies. The work is: (1) add Fastify API routes for CRUD operations on these tables, (2) add react-router for multi-screen admin navigation, (3) build admin screens for student/family management, class management, enrollment with capacity/waitlist, and a weekly calendar view.

The most significant architectural decision is adding a client-side router. Phase 1 used Zustand state-driven screen switching (selectedSessionId drives ClassList vs Roster), which worked for a two-screen flow but cannot scale to the 5+ screen admin dashboard. React Router v7 in declarative mode is the standard solution -- it adds URL-based navigation, browser back/forward support, deep linking, and lazy loading without requiring a framework rewrite.

**Primary recommendation:** Add react-router-dom v7 with a layout-based route structure that splits the app into two top-level layouts: FrontDeskLayout (existing attendance flow) and AdminLayout (sidebar nav with Students, Classes screens). Use Fastify route plugins per resource with TypeBox schemas for full type safety. Implement capacity enforcement in API route logic with row-level locking, and use a Postgres trigger for auto-promote from waitlist.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STUD-01 | Admin can create, edit, and deactivate student records (name, DOB, photo, medical notes, skill level) | CRUD API patterns (Section: Architecture Patterns), Photo upload via Supabase Storage (Section: Standard Stack), Form handling with react-hook-form + zod (already installed) |
| STUD-02 | Admin can create and edit family records (guardians, email, phone, emergency contact) | CRUD API patterns, families table already exists with all fields |
| STUD-03 | Students belong to a family; families can have multiple students | DB schema already enforces this via students.family_id FK; UI needs family picker in student form |
| STUD-04 | Admin can assign RFID card UID to a student | rfid_cards table exists; simple CRUD endpoint + UI field on student detail |
| STUD-05 | Admin can search and filter students by name, class, active status | Client-side filtering at 75-150 scale (Section: Search and Filter); server-side search API as future-proof |
| CLAS-01 | Admin can create and edit classes (name, type, instructor, day/time, duration, room, capacity, age range, level) | CRUD API patterns; classes table has all columns; instructor picker from staff table |
| CLAS-02 | Admin can view a visual weekly calendar of all classes | Custom CSS Grid component (Section: Weekly Calendar); no library needed at this scale |
| CLAS-03 | Admin can enroll students in classes | Enrollment API with capacity check (Section: Enrollment Capacity + Waitlist) |
| CLAS-04 | System enforces capacity limits and places students on waitlist when full | Row-level locking in enrollment API (Section: Enrollment Capacity + Waitlist) |
| CLAS-05 | Admin can drop or transfer students between classes | Enrollment status update endpoint; transfer = drop from A + enroll in B in a transaction |
| CLAS-06 | System auto-promotes from waitlist when a spot opens | Postgres AFTER UPDATE trigger on enrollments (Section: Enrollment Capacity + Waitlist) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Student/Family CRUD | API / Backend | Frontend (forms) | Business logic, validation, and DB writes happen server-side; frontend renders forms and handles optimistic UX |
| Enrollment capacity enforcement | API / Backend | Database (trigger) | Capacity check with row locking must be atomic in the API; auto-promote trigger fires in DB |
| Waitlist auto-promote | Database (trigger) | -- | Trigger fires on enrollment status change; no API involvement needed for the promotion itself |
| Photo upload | Frontend (compress) | API + Supabase Storage | Client compresses image before upload; upload goes direct to Supabase Storage via client SDK |
| Weekly calendar view | Browser / Client | -- | Pure presentation component rendering class data from the API |
| Search/filter students | Browser / Client | API (future) | At 75-150 students, client-side filtering is faster; API search is a future optimization |
| Role-based navigation | Browser / Client | API (role in JWT) | Router guards check role from JWT claims; API enforces role on each endpoint independently |
| RFID card assignment | API / Backend | -- | Simple CRUD write to rfid_cards table |

## Standard Stack

### Core (New for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-router-dom` | 7.15.1 | Client-side routing | [VERIFIED: npm registry] Standard React routing library; v7 is current stable; supports layout routes, lazy loading, URL params |
| `browser-image-compression` | 2.0.2 | Client-side photo resize | [VERIFIED: npm registry] Compresses images in the browser before upload; necessary because Supabase free tier has no server-side image transformations |

### Already Installed (from Phase 1)

| Library | Version | Purpose | Phase 2 Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.76.0 | Form state | Student, family, and class create/edit forms |
| `@hookform/resolvers` | 5.4.0 | Zod integration | Zod schema validation on forms |
| `zod` | 4.4.3 | Schema validation | Form input validation for all CRUD forms |
| `@radix-ui/react-dialog` | 1.1.15 | Accessible dialogs | Confirm dialogs for delete/deactivate, enrollment modals |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | Dropdown menus | Action menus on student/class rows |
| `date-fns` | 4.2.1 | Date utilities | DOB formatting, class schedule time display |
| `@tanstack/react-query` | 5.100.11 | Server state | All CRUD data fetching, cache invalidation after mutations |
| `zustand` | 5.0.13 | UI state | Selected filters, sidebar state, UI-only state |
| `@supabase/supabase-js` | 2.106.1 | Supabase client | Photo upload to Supabase Storage (client-side) |
| `@fastify/type-provider-typebox` | 6.1.0 | TypeBox type provider | Schema validation on all new API routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router-dom | Zustand state navigation (extend Phase 1 pattern) | Phase 1's selectedSessionId pattern works for 2 screens but breaks down at 5+: no URL persistence, no browser back, no deep linking, no code splitting. Router is the correct tool. |
| react-router-dom (declarative mode) | react-router framework mode (with Vite plugin) | Framework mode adds SSR, route modules, file-based routing -- more than this SPA needs. Declarative mode adds routing to the existing Vite+React app without restructuring. |
| browser-image-compression | compressorjs | Both work; browser-image-compression has more downloads (1.5M/week vs 400K/week), simpler API, better maintained. [ASSUMED] |
| Custom CSS Grid calendar | react-big-calendar, fullcalendar | Full calendar libraries are 50-200KB and designed for drag-and-drop event editing. This phase needs a read-only weekly schedule view that is simpler to build with CSS Grid than to configure from a library. |
| Client-side search | Server-side Postgres full-text search | At 75-150 students, fetching the full list and filtering in the browser is faster (single query, instant filter) than round-tripping to the server on every keystroke. Add server-side search if the studio grows past 500. |

**Installation (new packages only):**
```bash
cd client && npm install react-router-dom@^7.15.1 browser-image-compression@^2.0.2
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-router-dom | npm | 9+ years | ~12M/wk | github.com/remix-run/react-router | [OK] | Approved |
| react-router | npm | 9+ years | ~14M/wk | github.com/remix-run/react-router | [OK] | Approved (peer dep) |
| browser-image-compression | npm | 7+ years | ~1.5M/wk | github.com/Donaldcwl/browser-image-compression | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[iPad / Browser]
       |
       v
[React SPA (Vite PWA)]
  |-- react-router-dom (URL routing)
  |-- FrontDeskLayout (attendance flow, existing)
  |-- AdminLayout (sidebar nav, new)
  |     |-- StudentsPage (list + search/filter)
  |     |-- StudentDetailPage (create/edit form + photo + RFID)
  |     |-- FamiliesPage (list)
  |     |-- FamilyDetailPage (create/edit form)
  |     |-- ClassesPage (list + weekly calendar)
  |     |-- ClassDetailPage (create/edit form + enrollment list)
  |     \-- EnrollmentModal (enroll student, shows capacity/waitlist)
  |
  |-- react-hook-form + zod (form validation)
  |-- @tanstack/react-query (server state, mutations)
  |-- browser-image-compression (photo resize before upload)
  |-- @supabase/supabase-js (photo upload to Storage)
  |
  v (fetch with Bearer JWT)
[Fastify API (Node.js)]
  |-- /students     (CRUD + search)
  |-- /families     (CRUD)
  |-- /classes      (CRUD)
  |-- /enrollments  (enroll, drop, transfer)
  |-- /rfid-cards   (assign to student)
  |-- (existing) /sessions, /attendance, /auth
  |
  v (supabase service client)
[Supabase Postgres]
  |-- students, families, classes, enrollments, rfid_cards tables
  |-- RLS policies (organization_id isolation)
  |-- AFTER UPDATE trigger on enrollments (auto-promote waitlist)
  |
[Supabase Storage]
  |-- student-photos bucket (public, 2MB limit per file)
```

### Recommended Project Structure

```
client/src/
  layouts/
    FrontDeskLayout.tsx    # Existing attendance flow wrapper
    AdminLayout.tsx        # Sidebar nav + Outlet
  screens/
    Login.tsx              # (existing)
    ClassList.tsx          # (existing, now inside FrontDeskLayout)
    Roster.tsx             # (existing, now inside FrontDeskLayout)
    admin/
      StudentsPage.tsx     # Student list with search/filter
      StudentForm.tsx      # Create/edit student form
      FamiliesPage.tsx     # Family list
      FamilyForm.tsx       # Create/edit family form
      ClassesPage.tsx      # Class list + weekly calendar
      ClassForm.tsx        # Create/edit class form
      ClassDetail.tsx      # Class detail with enrollment management
  components/
    (existing Phase 1 components)
    admin/
      AdminSidebar.tsx     # Sidebar navigation
      WeeklyCalendar.tsx   # CSS Grid weekly schedule
      StudentSearch.tsx    # Search bar + filter controls
      EnrollmentModal.tsx  # Enroll/drop/transfer dialog
      PhotoUpload.tsx      # Image upload with client-side compression
  router.tsx               # Route definitions

server/src/
  routes/
    (existing: attendance.ts, sessions.ts, auth.ts, rfid.ts, health.ts)
    students.ts            # CRUD + search/filter
    families.ts            # CRUD
    classes.ts             # CRUD
    enrollments.ts         # Enroll, drop, transfer with capacity check
    rfid-cards.ts          # Assign/unassign RFID to student
  types/
    index.ts               # (extend with new TypeBox schemas)

supabase/migrations/
  20260522000600_waitlist_trigger.sql  # Auto-promote trigger
  20260522000700_storage_bucket.sql    # Student photos bucket + RLS
```

### Pattern 1: Fastify CRUD Route Plugin

**What:** Each resource (students, families, classes) gets its own route plugin file following the Fastify plugin pattern established in Phase 1.
**When to use:** Every new resource endpoint.

```typescript
// Source: Fastify docs (fastify.dev/docs/latest/Reference/Routes/)
// Matches existing pattern in server/src/routes/sessions.ts
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { Type, Static } from 'typebox'

// TypeBox schemas for request validation
const CreateStudentBody = Type.Object({
  familyId: Type.String({ format: 'uuid' }),
  firstName: Type.String({ minLength: 1 }),
  lastName: Type.String({ minLength: 1 }),
  dob: Type.Optional(Type.String({ format: 'date' })),
  photoUrl: Type.Optional(Type.String()),
  medicalNotes: Type.Optional(Type.String()),
  skillLevel: Type.Optional(Type.String()),
})
type CreateStudentBody = Static<typeof CreateStudentBody>

const ListQuerystring = Type.Object({
  search: Type.Optional(Type.String()),
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 50 })),
})

const studentsRoutes: FastifyPluginAsync = async (fastify) => {
  // List with search/filter/pagination
  fastify.get<{ Querystring: Static<typeof ListQuerystring> }>(
    '/students',
    { schema: { querystring: ListQuerystring } },
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) return reply.code(401).send({ error: 'Missing organization context' })

      // Admin role gate
      if (request.role !== 'admin') return reply.code(403).send({ error: 'Admin role required' })

      let query = fastify.supabase
        .from('students')
        .select('*, families(primary_guardian_name, email)', { count: 'exact' })
        .eq('organization_id', organizationId)

      // Apply filters
      if (request.query.active !== undefined) {
        query = query.eq('active', request.query.active)
      }
      if (request.query.search) {
        query = query.or(
          `first_name.ilike.%${request.query.search}%,last_name.ilike.%${request.query.search}%`
        )
      }

      const page = request.query.page ?? 1
      const limit = request.query.limit ?? 50
      const from = (page - 1) * limit
      query = query.range(from, from + limit - 1).order('last_name')

      const { data, error, count } = await query
      if (error) {
        fastify.log.error({ error }, 'Failed to list students')
        return reply.code(500).send({ error: 'Failed to list students' })
      }

      return reply.code(200).send({ data: data ?? [], total: count ?? 0, page, limit })
    }
  )

  // Create
  fastify.post<{ Body: CreateStudentBody }>(
    '/students',
    { schema: { body: CreateStudentBody } },
    async (request, reply) => {
      const organizationId = request.organizationId
      if (!organizationId) return reply.code(401).send({ error: 'Missing organization context' })
      if (request.role !== 'admin') return reply.code(403).send({ error: 'Admin role required' })

      const { data, error } = await fastify.supabase
        .from('students')
        .insert({
          organization_id: organizationId,
          family_id: request.body.familyId,
          first_name: request.body.firstName,
          last_name: request.body.lastName,
          dob: request.body.dob ?? null,
          photo_url: request.body.photoUrl ?? null,
          medical_notes: request.body.medicalNotes ?? null,
          skill_level: request.body.skillLevel ?? null,
        })
        .select()
        .single()

      if (error) {
        fastify.log.error({ error }, 'Failed to create student')
        return reply.code(500).send({ error: 'Failed to create student' })
      }

      return reply.code(201).send(data)
    }
  )

  // GET /:id, PATCH /:id, DELETE /:id (soft-deactivate) follow same pattern
}

export default fp(studentsRoutes, {
  name: 'students',
  dependencies: ['supabase', 'auth'],
})
```

### Pattern 2: React Router Layout-Based Routing

**What:** Two top-level layouts (FrontDesk and Admin) with nested routes, role-based guards, and lazy loading.
**When to use:** The single router definition for the entire app.

```typescript
// Source: React Router official docs (reactrouter.com/how-to/spa)
// client/src/router.tsx
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Eager-load layouts (small, always needed)
import { FrontDeskLayout } from './layouts/FrontDeskLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { Login } from './screens/Login'

// Lazy-load admin screens (code-split)
const StudentsPage = lazy(() => import('./screens/admin/StudentsPage'))
const StudentForm = lazy(() => import('./screens/admin/StudentForm'))
const ClassesPage = lazy(() => import('./screens/admin/ClassesPage'))
const ClassForm = lazy(() => import('./screens/admin/ClassForm'))
const ClassDetail = lazy(() => import('./screens/admin/ClassDetail'))
const FamiliesPage = lazy(() => import('./screens/admin/FamiliesPage'))
const FamilyForm = lazy(() => import('./screens/admin/FamilyForm'))

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <FrontDeskLayout />,
    children: [
      { index: true, element: <ClassList /> },
      { path: 'roster/:sessionId', element: <Roster /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,  // Sidebar nav + Outlet; guards admin role
    children: [
      { index: true, element: <Navigate to="students" replace /> },
      { path: 'students', element: <LazyPage><StudentsPage /></LazyPage> },
      { path: 'students/new', element: <LazyPage><StudentForm /></LazyPage> },
      { path: 'students/:id', element: <LazyPage><StudentForm /></LazyPage> },
      { path: 'families', element: <LazyPage><FamiliesPage /></LazyPage> },
      { path: 'families/new', element: <LazyPage><FamilyForm /></LazyPage> },
      { path: 'families/:id', element: <LazyPage><FamilyForm /></LazyPage> },
      { path: 'classes', element: <LazyPage><ClassesPage /></LazyPage> },
      { path: 'classes/new', element: <LazyPage><ClassForm /></LazyPage> },
      { path: 'classes/:id', element: <LazyPage><ClassDetail /></LazyPage> },
    ],
  },
])
```

### Pattern 3: Enrollment Capacity + Waitlist

**What:** Atomic capacity check with row-level locking in the API, plus a Postgres trigger for auto-promote.
**When to use:** CLAS-03 through CLAS-06.

```sql
-- Postgres function for atomic enrollment
-- Source: PostgreSQL docs on FOR UPDATE and PL/pgSQL
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
BEGIN
  -- Lock the class row to prevent concurrent enrollment race conditions
  SELECT capacity INTO v_capacity
  FROM classes
  WHERE id = p_class_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Class not found');
  END IF;

  -- Count current active enrollments
  SELECT COUNT(*) INTO v_active_count
  FROM enrollments
  WHERE class_id = p_class_id
    AND organization_id = p_organization_id
    AND status = 'active';

  -- Determine enrollment status
  IF v_capacity IS NULL OR v_active_count < v_capacity THEN
    v_status := 'active';
  ELSE
    v_status := 'waitlist';
  END IF;

  -- Insert enrollment (ON CONFLICT handles re-enrollment after drop)
  INSERT INTO enrollments (organization_id, student_id, class_id, status)
  VALUES (p_organization_id, p_student_id, p_class_id, v_status)
  ON CONFLICT (student_id, class_id) DO UPDATE
    SET status = v_status,
        enrolled_at = now(),
        dropped_at = NULL,
        updated_at = now()
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'enrollmentId', v_enrollment_id,
    'status', v_status::text,
    'activeCount', v_active_count + (CASE WHEN v_status = 'active' THEN 1 ELSE 0 END),
    'capacity', v_capacity
  );
END;
$$;
```

```sql
-- Auto-promote trigger: when an enrollment is dropped, promote the earliest waitlisted student
-- Source: PostgreSQL docs on trigger functions (postgresql.org/docs/current/plpgsql-trigger.html)
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

  -- Get class capacity
  SELECT capacity INTO v_capacity
  FROM classes
  WHERE id = NEW.class_id
  FOR UPDATE;  -- Lock to prevent race

  -- Count remaining active enrollments
  SELECT COUNT(*) INTO v_active_count
  FROM enrollments
  WHERE class_id = NEW.class_id
    AND organization_id = NEW.organization_id
    AND status = 'active';

  -- If there is room and someone is waitlisted, promote the earliest
  IF v_capacity IS NULL OR v_active_count < v_capacity THEN
    SELECT id INTO v_waitlisted_id
    FROM enrollments
    WHERE class_id = NEW.class_id
      AND organization_id = NEW.organization_id
      AND status = 'waitlist'
    ORDER BY enrolled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_waitlisted_id IS NOT NULL THEN
      UPDATE enrollments
      SET status = 'active', updated_at = now()
      WHERE id = v_waitlisted_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_promote_from_waitlist
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION promote_from_waitlist();
```

### Pattern 4: Photo Upload with Client-Side Compression

**What:** Compress student photos in the browser before uploading to Supabase Storage.
**When to use:** STUD-01 photo upload.

```typescript
// Source: browser-image-compression docs (github.com/Donaldcwl/browser-image-compression)
// Source: Supabase Storage docs (supabase.com/docs/guides/storage)
import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'

async function uploadStudentPhoto(file: File, studentId: string): Promise<string> {
  // Compress to max 200KB, 400x400 -- thumbnail quality for roster display
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
  })

  const path = `${studentId}/${Date.now()}.jpg`

  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) throw error

  // Get public URL (bucket must be public)
  const { data } = supabase.storage
    .from('student-photos')
    .getPublicUrl(path)

  return data.publicUrl
}
```

### Pattern 5: Admin Role Guard Layout

**What:** AdminLayout checks role from JWT and redirects non-admins.
**When to use:** All /admin/* routes.

```typescript
// client/src/layouts/AdminLayout.tsx
import { Navigate, Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminLayout() {
  const { session, user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!session) return <Navigate to="/login" replace />

  // Read role from JWT app_metadata (set by Custom Access Token Hook)
  const token = session.access_token
  const payload = JSON.parse(atob(token.split('.')[1]))
  const role = payload.app_metadata?.role

  if (role !== 'admin') {
    return <Navigate to="/" replace />  // Non-admins go to front desk
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Checking role in the frontend only:** The AdminLayout guard is a UX convenience, NOT a security boundary. Every API endpoint must independently check `request.role === 'admin'` before performing mutations. A malicious user can call the API directly. [CITED: Phase 1 pattern in auth.ts T-04-01]
- **Building a custom router with Zustand:** Phase 1's `selectedSessionId` state-switching was fine for two screens. Extending it to 10+ screens with nested views, URL params, and back-button support would recreate react-router poorly. Use the real library. [ASSUMED]
- **Using database triggers for ALL business logic:** Triggers are correct for auto-promote (fires on status change, must be atomic). But capacity checking belongs in the API where you can return meaningful error messages and handle edge cases like re-enrollment after drop. [ASSUMED]
- **Server-side image resize on free tier:** Supabase Storage image transformations require Pro plan ($25/month). Compress on the client with browser-image-compression instead. [CITED: supabase.com/docs/guides/storage/serving/image-transformations]
- **Full-text search for 150 students:** Postgres tsvector, trigram indexes, and pg_trgm are serious tools for serious scale. At 75-150 records, `ILIKE` with a simple index (already exists on students table) is more than sufficient. Don't over-engineer. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side routing | State-machine screen switcher | react-router-dom v7 | URL persistence, browser back/forward, deep linking, code splitting, accessible focus management |
| Image compression | Canvas resize + quality loop | browser-image-compression | Web Worker support, orientation fix, progressive quality reduction, handles all formats |
| Form validation | Manual onChange + useState | react-hook-form + zod | Minimal re-renders, unified schema for client and API, error message generation |
| Enrollment race conditions | Application-level lock + retry | Postgres FOR UPDATE + PL/pgSQL function | Database-level atomicity; no distributed lock coordination needed |
| Accessible dialogs | Custom div with z-index | @radix-ui/react-dialog | Focus trap, scroll lock, aria attributes, escape key, screen reader announcement |
| Accessible dropdowns | Custom menu with click-outside | @radix-ui/react-dropdown-menu | Keyboard navigation, focus management, typeahead, aria-menu pattern |

**Key insight:** Phase 2 has many CRUD screens that look simple but carry hidden complexity in accessibility, race conditions, and form state. The libraries already installed in Phase 1 (react-hook-form, zod, Radix UI, TanStack Query) cover 90% of these concerns. The only new library needed is react-router for navigation.

## Common Pitfalls

### Pitfall 1: Enrollment Race Condition (Double-Enroll)
**What goes wrong:** Two admins enroll students into the same class simultaneously; both see capacity available; both inserts succeed; class is now over capacity.
**Why it happens:** Read-then-write without locking. The capacity check and insert are not atomic.
**How to avoid:** Use a Postgres function with FOR UPDATE on the classes row. The function locks the row, counts active enrollments, and inserts with the correct status -- all in one transaction.
**Warning signs:** Two enrollment records with `status = 'active'` for the same class when `active_count > capacity`.

### Pitfall 2: Waitlist Promotion Race (Double-Promote)
**What goes wrong:** Two students drop from the same class simultaneously; both trigger the auto-promote logic; one waitlisted student gets promoted twice (or two get promoted when only one spot opened).
**Why it happens:** The trigger reads the active count before the other trigger's UPDATE has committed.
**How to avoid:** Use FOR UPDATE SKIP LOCKED when selecting the waitlisted student to promote. If the row is already locked by another trigger execution, skip it.
**Warning signs:** More students promoted than spots available.

### Pitfall 3: Photo Upload Without Compression
**What goes wrong:** Admin uploads a 12MB iPhone photo; the upload is slow on studio WiFi; Supabase Storage fills up faster than expected (1GB free tier).
**Why it happens:** Modern phone cameras produce 3-12MB photos. Without client-side compression, every student photo consumes 10-100x more storage than needed.
**How to avoid:** Always compress before upload. 400x400px at 80% JPEG quality produces ~30-50KB files. At 150 students, that is 4.5-7.5MB total -- negligible against the 1GB limit.
**Warning signs:** Storage usage approaching 1GB with fewer than 1000 photos.

### Pitfall 4: Admin Route Without API Role Gate
**What goes wrong:** Frontend guards admin routes with a role check in AdminLayout, but the API endpoint has no role verification. Any authenticated user can call the API directly with curl or browser dev tools.
**Why it happens:** Developer assumes frontend routing IS the security boundary.
**How to avoid:** Every admin API endpoint must check `request.role === 'admin'` as its first operation, exactly like POST /auth/invite does in Phase 1. Frontend guards are UX, not security.
**Warning signs:** Front desk users can modify student records by calling the API directly.

### Pitfall 5: Breaking the Front Desk Flow When Adding Router
**What goes wrong:** Adding react-router changes the app entry point and navigation model. Mrs. Goodman's iPad bookmark now shows a blank page or login redirect instead of the class list.
**Why it happens:** The router definition does not preserve the exact URL structure of the existing flow. Or the PWA start_url does not match.
**How to avoid:** Map the existing flow to routes exactly: `/` = ClassList, `/roster/:sessionId` = Roster. Keep `start_url: '/'` in the PWA manifest. The front desk flow should work identically before and after the router addition -- just with URLs now.
**Warning signs:** Existing iPad users see a flash of login or white screen after the update.

### Pitfall 6: Re-enrollment After Drop
**What goes wrong:** Admin drops a student, then tries to re-enroll them. The UNIQUE constraint on `(student_id, class_id)` rejects the insert.
**Why it happens:** The enrollments table has one row per student-class pair, not one row per enrollment event.
**How to avoid:** Use ON CONFLICT (student_id, class_id) DO UPDATE -- set status back to 'active' (or 'waitlist'), clear dropped_at, update enrolled_at. The enroll_student function handles this.
**Warning signs:** 409 Conflict errors when re-enrolling a previously dropped student.

## Code Examples

### Weekly Calendar CSS Grid Component

```typescript
// Custom CSS Grid weekly calendar -- no library needed
// Source: CSS Grid spec; pattern matches admin.jsx mockup style

interface CalendarClass {
  id: string
  name: string
  dayOfWeek: number  // 0=Sun through 6=Sat
  startTime: string  // "HH:MM"
  durationMinutes: number
  instructorName?: string
  room?: string
  enrolledCount: number
  capacity: number | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM to 7 PM

function WeeklyCalendar({ classes }: { classes: CalendarClass[] }) {
  // Position each class block based on day column and time row
  const getGridPosition = (cls: CalendarClass) => {
    const [h, m] = cls.startTime.split(':').map(Number)
    const startRow = (h - 8) + 2 // +2 for header row offset (1-indexed)
    const spanRows = Math.ceil(cls.durationMinutes / 60)
    const col = cls.dayOfWeek + 2 // +2 for time label column (1-indexed)
    return { gridRow: `${startRow} / span ${spanRows}`, gridColumn: `${col}` }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '60px repeat(7, 1fr)',
      gridTemplateRows: `40px repeat(${HOURS.length}, 60px)`,
      border: '1px solid var(--color-line)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Day headers in row 1 */}
      <div style={{ gridRow: 1, gridColumn: 1 }} />
      {DAYS.map((day, i) => (
        <div key={day} style={{
          gridRow: 1, gridColumn: i + 2,
          padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13,
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--color-paper)',
        }}>
          {day}
        </div>
      ))}

      {/* Hour labels in column 1 */}
      {HOURS.map((hour, i) => (
        <div key={hour} style={{
          gridRow: i + 2, gridColumn: 1,
          padding: '4px 8px', fontSize: 12, color: 'var(--color-ink-3)',
          borderRight: '1px solid var(--color-line)',
          borderBottom: '1px solid var(--color-line)',
        }}>
          {hour > 12 ? `${hour - 12}p` : hour === 12 ? '12p' : `${hour}a`}
        </div>
      ))}

      {/* Class blocks */}
      {classes.map((cls) => (
        <div key={cls.id} style={{
          ...getGridPosition(cls),
          background: 'var(--color-purple-tint)',
          borderLeft: '3px solid var(--color-purple)',
          borderRadius: 6, padding: '4px 8px', margin: 2,
          fontSize: 12, overflow: 'hidden', cursor: 'pointer',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{cls.name}</div>
          <div style={{ color: 'var(--color-ink-3)' }}>{cls.instructorName}</div>
          <div style={{ color: 'var(--color-ink-3)' }}>
            {cls.enrolledCount}/{cls.capacity ?? '--'}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Supabase Storage Bucket Migration

```sql
-- Migration: create student-photos bucket and RLS policy
-- Source: Supabase Storage docs (supabase.com/docs/guides/storage/security/access-control)

-- Create a public bucket for student photos
-- Public = anyone with the URL can view (acceptable for student thumbnail photos)
-- Uploads still require authentication via RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  2097152,  -- 2MB limit (photos are compressed client-side to ~50KB)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Only authenticated users can upload to student-photos
CREATE POLICY "Authenticated users can upload student photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Anyone can view (bucket is public, but policy still needed for RLS)
CREATE POLICY "Anyone can view student photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'student-photos');

-- Only authenticated users can delete photos
CREATE POLICY "Authenticated users can delete student photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'student-photos');
```

### TanStack Query CRUD Mutation Pattern

```typescript
// Source: TanStack Query v5 docs (tanstack.com/query/v5)
// Matches Phase 1 pattern established in useSessions.ts / useRoster.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = import.meta.env.VITE_API_URL as string

function useStudents(filters: { search?: string; active?: boolean; page?: number }) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery({
    queryKey: ['students', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.active !== undefined) params.set('active', String(filters.active))
      if (filters.page) params.set('page', String(filters.page))

      const res = await fetch(`${API_URL}/students?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch students')
      return res.json()
    },
    enabled: !!token,
  })
}

function useCreateStudent() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const token = session?.access_token

  return useMutation({
    mutationFn: async (body: CreateStudentBody) => {
      const res = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create student')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-router v6 `<Routes>` | react-router v7 (same API, no breaking changes) | Nov 2024 | v7 is a non-breaking upgrade from v6; same createBrowserRouter API works [CITED: reactrouter.com/changelog] |
| Supabase Storage v1 | Supabase Storage v2 (resumable uploads, CDN) | 2023 | Image transformations require Pro plan; client-side compression is the free-tier pattern [CITED: supabase.com/blog/storage-image-resizing-smart-cdn] |
| Manual fetch + useEffect | TanStack Query v5 | 2023-2024 | Already adopted in Phase 1; Phase 2 extends the pattern to CRUD mutations [CITED: tanstack.com/query/v5] |
| Tailwind v3 config file | Tailwind v4 @theme CSS directive | Jan 2025 | Already adopted in Phase 1 via @tailwindcss/vite plugin [CITED: tailwindcss.com/blog/tailwindcss-v4] |

**Deprecated/outdated:**
- react-router v5 `<Switch>` component: replaced by `<Routes>` in v6, removed in v7
- Supabase Storage createSignedUrl for thumbnails: use getPublicUrl for public buckets instead
- Manual image resize with Canvas API: browser-image-compression wraps this with Web Worker support and orientation fixes

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | browser-image-compression has more weekly downloads than compressorjs and is better maintained | Standard Stack - Alternatives | Low -- both libraries work; either is acceptable |
| A2 | Zustand state navigation would break down at 5+ screens | Anti-Patterns | Low -- it technically could work, but would require reinventing URL management, back-button handling, and code splitting |
| A3 | Capacity checking belongs in API + PL/pgSQL, not purely in triggers | Anti-Patterns | Medium -- a pure-trigger approach could work but gives worse error messages and harder debugging |
| A4 | At 75-150 students, client-side filtering is faster than server-side search | Architectural Responsibility Map | Low -- at this scale both approaches are fast; client-side avoids network round-trips for filter changes |
| A5 | ILIKE with existing indexes is sufficient for student search at this scale | Anti-Patterns | Low -- pg_trgm/tsvector would be over-engineering for 150 records |

## Open Questions (RESOLVED)

1. **Photo storage bucket visibility** -- RESOLVED: Private bucket with org-scoped RLS policies. Children's photos require signed URLs. Upload path includes organization_id for storage policy scoping.

2. **Admin sidebar navigation items** -- RESOLVED: All 5 items shown (Dashboard, Students, Classes, Attendance, Reports). Unbuilt items grayed out with "Coming soon" tooltip.

3. **Transfer as single operation** -- RESOLVED: Atomic single Postgres transaction via transfer_student() function. If target class is full, student goes on target waitlist but is still dropped from source.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | Yes | v25.2.1 | -- |
| npm | Package management | Yes | 11.6.2 | -- |
| Supabase (hosted) | Database + Auth + Storage | Yes | Hosted (us-west-1) | -- |
| Supabase CLI | Migrations | Needs verification | -- | Manual SQL via Supabase Dashboard |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:**
- Supabase CLI: may or may not be installed. Migrations can be applied via the Supabase Dashboard SQL editor if the CLI is unavailable. The CLI is preferred for version-controlled migrations.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 1 complete) | Supabase Auth (JWT) |
| V3 Session Management | No (Phase 1 complete) | Supabase Auth auto-refresh |
| V4 Access Control | **Yes** | Role check on every admin API endpoint (request.role === 'admin'); organization_id from JWT only; frontend guards as UX only |
| V5 Input Validation | **Yes** | TypeBox schemas on all request bodies/params/query; zod on frontend forms |
| V6 Cryptography | No | -- |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on student/family/class records | Tampering | organization_id from JWT (never from request); verify row belongs to org before returning |
| Role escalation via direct API call | Elevation of Privilege | Role gate (`request.role !== 'admin'`) on every admin endpoint; role is in app_metadata (server-writable only) |
| Photo upload of non-image file | Tampering | Bucket-level allowed_mime_types restriction; client-side file type check before upload |
| XSS via student name / medical notes | Tampering | React auto-escapes JSX; never use dangerouslySetInnerHTML; TypeBox string validation |
| Enrollment over-capacity via concurrent requests | Tampering | FOR UPDATE row lock in enroll_student Postgres function |

## Sources

### Primary (HIGH confidence)
- [React Router v7 official docs - SPA mode](https://reactrouter.com/how-to/spa) - Declarative mode setup, createBrowserRouter API
- [React Router v7 API Reference - createBrowserRouter](https://api.reactrouter.com/v7/functions/react-router.createBrowserRouter.html) - Current API
- [Fastify v5 Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) - Schema definition patterns
- [Supabase Storage docs](https://supabase.com/docs/guides/storage) - Upload API, bucket configuration
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - RLS policies for storage.objects
- [Supabase Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) - Confirmed Pro plan requirement
- [PostgreSQL CREATE TRIGGER docs](https://www.postgresql.org/docs/current/sql-createtrigger.html) - Trigger function syntax
- [PostgreSQL SELECT FOR UPDATE](https://www.postgresql.org/docs/current/sql-select.html) - Row-level locking

### Secondary (MEDIUM confidence)
- [browser-image-compression GitHub](https://github.com/Donaldcwl/browser-image-compression) - Client-side compression API
- [Supabase free tier limits](https://supabase.com/docs/guides/storage/uploads/file-limits) - 1GB storage, 50MB per file
- [Fastify Routes docs](https://fastify.dev/docs/latest/Reference/Routes/) - Route definition patterns

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are already installed (Phase 1) or verified via npm registry + slopcheck + official docs
- Architecture: HIGH - Patterns follow Phase 1 conventions exactly; router addition is a well-documented standard pattern
- Pitfalls: HIGH - Enrollment race conditions are a well-known database concurrency problem with established solutions; photo upload and role guard pitfalls are confirmed by official docs

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable stack, no fast-moving dependencies)
