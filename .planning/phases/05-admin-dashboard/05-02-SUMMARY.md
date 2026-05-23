---
phase: "05"
plan: "02"
subsystem: reports
tags: [reports, csv-export, enrollment, revenue, attendance, admin]
dependency_graph:
  requires: [05-01]
  provides: [enrollment-report, revenue-report, attendance-report, csv-export]
  affects: [server/src/index.ts, client/src/router.tsx]
tech_stack:
  added: []
  patterns: [tabbed-ui, date-range-query, csv-blob-download, summary-cards]
key_files:
  created:
    - server/src/routes/reports.ts
    - client/src/screens/admin/ReportsPage.tsx
  modified:
    - server/src/index.ts
    - client/src/router.tsx
decisions:
  - CSV export uses client-side Blob creation from API rows array (no server-side CSV generation)
  - Revenue monthly trend groups by YYYY-MM from payment paid_at and invoice due_date
  - Attendance rate = (present + late) / total records, consistent with dashboard KPI definition
metrics:
  duration: 6min
  completed: 2026-05-23
---

# Phase 5 Plan 2: Reports -- Enrollment, Revenue, Attendance + CSV Export Summary

Admin can generate enrollment, revenue, and attendance rate reports with date range filtering and export any report as CSV.

## What Was Built

### Report API Endpoints (server/src/routes/reports.ts)

Three admin-only GET endpoints, all org-scoped via JWT organization_id:

1. **GET /reports/enrollment** -- Per-class breakdown of active/waitlist/dropped enrollments, summary with total active students, new enrollments in period, drops in period. CSV rows: class_name, active, waitlist, dropped.

2. **GET /reports/revenue** -- Total collected payments in period, outstanding/overdue invoice totals, breakdown by payment method (stripe/cash/check), monthly trend with collected vs invoiced amounts. CSV rows: month, collected, invoiced.

3. **GET /reports/attendance** -- Overall attendance rate (present+late/total), per-class attendance breakdown with individual rates. CSV rows: class_name, total_records, present, absent, late, excused, rate.

All endpoints validate start_date/end_date query params and return 400 if missing.

### Reports Page (client/src/screens/admin/ReportsPage.tsx)

Tabbed UI with three tabs (Enrollment | Revenue | Attendance), date range picker defaulting to current month, and per-tab content:

- **Summary cards** at the top of each tab showing key metrics with accent colors matching the design system
- **Data tables** with sortable breakdowns per class or per month
- **Export CSV button** (purple, top-right) that converts the API rows array to a CSV Blob and triggers browser download with a descriptive filename
- **Attendance rate color coding**: green for >=90%, neutral for >=75%, red for <75%

### Router Integration

Replaced the inline "Coming soon" placeholder at /admin/reports with a lazy-loaded ReportsPage component. The Reports NavLink in AdminSidebar was already active from Plan 05-01.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Report API endpoints | 6ba7769 | server/src/routes/reports.ts, server/src/index.ts |
| 2 | Reports page with tabbed UI | ea82be1 | client/src/screens/admin/ReportsPage.tsx |
| 3 | Wire into router | f6588e5 | client/src/router.tsx |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- [x] All 3 report endpoints created with correct aggregation logic
- [x] Reports page renders with 3 tabs and date range picker
- [x] Each tab shows summary cards + data table
- [x] CSV export converts rows to downloadable file
- [x] Reports link active in sidebar (from Plan 05-01)
- [x] TypeScript compiles cleanly (server and client)

## Self-Check: PASSED

All created files exist on disk. All commit hashes verified in git log.
