# Phase 5 Plan 01: Admin Dashboard -- KPI Cards + Today's Classes Summary

Live operations dashboard showing daily KPIs (classes, attendance, absences, RFID check-ins) and today's class summary cards with progress bars and status badges, matching the admin.jsx mockup design.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Dashboard API endpoint | `5f1038b` | `server/src/routes/dashboard.ts`, `server/src/index.ts` |
| 2 | Dashboard page component | `b810471` | `client/src/screens/admin/DashboardPage.tsx` |
| 3 | Sidebar + router activation | `76c48bc` | `client/src/components/admin/AdminSidebar.tsx`, `client/src/router.tsx` |

## What Was Built

### Backend: GET /dashboard/today

Single endpoint returning all dashboard data in one request:
- **KPIs:** classesToday, studentsCheckedIn, totalEnrolledToday, absencesToday, excusedToday, rfidCheckinsWeek (7-day window)
- **Class summaries:** Array of today's classes with className, time (formatted 12h AM/PM), instructorName (joined from staff table), presentCount, absentCount, totalEnrolled, session status, markedBy label
- Role-gated to admin and front_desk
- Organization-scoped via JWT claims (request.organizationId)
- Joins class_sessions -> classes -> staff for instructor names
- Counts attendance_records per session for present/absent/excused
- RFID count query is non-fatal (degrades gracefully on error)

### Frontend: DashboardPage

- 4 KPI cards matching mockup: purple (classes), green (checked in), red (absences), indigo (RFID)
- KPI cards show computed subtitles (e.g., "3 complete . 1 in progress")
- Today's classes grid with SummaryCard components
- Each SummaryCard: time, class name, instructor, present/total count, absent count, progress bar
- Status badges: Complete (green checkmark), In progress (purple pulsing dot), Pending (gray uppercase)
- RFID badge on the KPI card with WiFi-signal icon
- Auto-refreshes every 30 seconds via TanStack Query refetchInterval
- Responsive grid: up to 4 columns based on class count
- Loading spinner and empty state handled

### Navigation Updates

- Dashboard NavLink activated in sidebar (was grayed-out span)
- Admin index redirect changed from /admin/students to /admin/dashboard
- Attendance link activated, points to front desk view (/)
- Reports link activated with inline placeholder (Plan 05-02 will build the page)
- Reports route added to router with placeholder content

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing functionality] Reports route placeholder**
- **Found during:** Task 3
- **Issue:** Sidebar Reports link would 404 since no ReportsPage exists yet
- **Fix:** Added inline placeholder route at /admin/reports with "Coming soon" message
- **Files modified:** `client/src/router.tsx`
- **Commit:** `76c48bc`

## Decisions Made

- **30-second auto-refresh:** Dashboard uses `refetchInterval: 30_000` for live ops monitoring during class hours. This keeps KPIs current without manual refresh.
- **Single API call:** All dashboard data (KPIs + class summaries) returned in one GET request rather than separate calls, reducing network overhead and simplifying the frontend query.
- **RFID error tolerance:** The RFID check-in count query logs errors but does not fail the endpoint, since RFID is in pilot mode and the rest of the dashboard should still work.

## Known Stubs

None. All data is wired to live API queries.

## Metrics

- **Duration:** ~97 minutes
- **Tasks:** 3/3 completed
- **Files created:** 2 (dashboard.ts, DashboardPage.tsx)
- **Files modified:** 3 (index.ts, AdminSidebar.tsx, router.tsx)
