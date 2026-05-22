# Phase 4 Plan 03: Parent Portal -- Auth + Family Views Summary

Parent portal with magic link auth, JWT-scoped family data, and mobile-first React frontend for class schedules, attendance history, and contact management.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| T-04-03-01 | Parent auth -- role + magic link + access token hook | 9a1f797 | supabase/migrations/20260522000900_parent_auth.sql, server/src/plugins/auth.ts, server/src/routes/auth.ts, server/src/types/index.ts |
| T-04-03-02 | Parent-scoped API routes | 3204ebe | server/src/routes/parent.ts, server/src/index.ts |
| T-04-03-03 | Parent portal frontend | ea07487 | client/src/layouts/ParentLayout.tsx, client/src/screens/parent/*.tsx, client/src/hooks/useParent.ts, client/src/router.tsx, client/src/lib/supabase.ts |

## Key Decisions

1. **Staff takes precedence over parent in JWT hook**: If a user is both a staff member and a parent (edge case), the custom_access_token_hook gives them the staff role. This avoids ambiguity -- staff can always access admin routes.

2. **Family_id in JWT, never from request params**: All parent routes scope to family_id extracted from the JWT app_metadata. The `requireParent()` guard enforces this on every handler. Parents cannot access other families' data even if they guess a UUID.

3. **detectSessionInUrl enabled**: Changed from `false` to `true` in the Supabase client config so magic link tokens in the URL hash are automatically exchanged for a session. This was required for the magic link flow to work.

4. **Mobile-first card layout over tables**: ParentAttendance uses a card-based list instead of a traditional HTML table, since parents primarily access on phones. Each record shows student name, class, date, and color-coded status badge.

5. **Application-layer date filtering for attendance**: PostgREST cannot filter on nested join columns directly. Attendance date filtering (startDate/endDate against class_sessions.session_date) is applied in application code after the query returns. Acceptable at this scale (family-scoped data is small).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] detectSessionInUrl was false**
- **Found during:** Task 3
- **Issue:** The Supabase client had `detectSessionInUrl: false`, which would prevent magic link auth from working (the URL hash tokens would be silently ignored)
- **Fix:** Changed to `detectSessionInUrl: true` with explanatory comment
- **Files modified:** client/src/lib/supabase.ts
- **Commit:** ea07487

## Security Notes

- `custom_access_token_hook` is `SECURITY DEFINER` -- it runs with elevated privileges to read both `public.staff` and `public.families` tables
- `GRANT SELECT ON public.families TO supabase_auth_admin` added in migration 009 (required for the hook to read parent records)
- Parent invite endpoint (`POST /auth/invite-parent`) is admin-only -- parents cannot self-register
- All 5 parent API routes enforce: role='parent' + valid familyId + organizationId from JWT
- PATCH /parent/profile scopes the update to familyId from JWT, not from request body
- Parent cannot access admin routes (ParentLayout redirects, API returns 403)
- Magic link email is sent via Supabase's built-in email delivery -- no custom email infrastructure needed

## Threat Flags

No new threat surface beyond what the plan anticipated. All parent endpoints are read-only except PATCH /parent/profile which only updates contact fields (not students, enrollments, or billing).

## Self-Check: PASSED

All 15 files verified present on disk. All 3 commit hashes verified in git log.
