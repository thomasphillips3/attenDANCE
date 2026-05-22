---
phase: 04-communications
plan: 01
subsystem: notifications, email
tags: [resend, email, notifications, notification-log, transactional-email]

# Dependency graph
requires:
  - phase: 03-billing
    provides: Stripe webhook handler, invoice/payment tables, billing routes
  - phase: 02-studio-management
    provides: families table with email, students table, enrollments RPC, classes table
  - phase: 01-attendance
    provides: attendance_records table, session submit route
provides:
  - Resend SDK integration with lazy-init client
  - sendEmail() notification service with notification_log audit trail
  - HTML email templates (enrollment confirmation, payment receipt, absence alert)
  - Enrollment, payment, and absence email triggers wired into existing routes
  - GET /notifications admin API with pagination and channel filter
  - NotificationsPage admin screen with status badges and channel filter tabs
  - Communications nav item in AdminSidebar
affects: [04-sms, 04-notification-preferences, 05-parent-portal]

# Tech tracking
tech-stack:
  added: [resend@6.x]
  patterns: [fire-and-forget email sends, notification_log audit trail, lazy-init SDK client]

key-files:
  created:
    - supabase/migrations/20260522000800_notification_log_columns.sql
    - server/src/lib/notifications.ts
    - server/src/lib/email-templates.ts
    - server/src/routes/notifications.ts
    - client/src/hooks/useNotifications.ts
    - client/src/screens/admin/NotificationsPage.tsx
  modified:
    - server/package.json
    - server/src/types/index.ts
    - server/src/index.ts
    - server/src/routes/enrollments.ts
    - server/src/routes/webhooks.ts
    - server/src/routes/sessions.ts
    - client/src/components/admin/AdminSidebar.tsx
    - client/src/router.tsx

key-decisions:
  - "Used existing notification_log table from migration 000100, added missing columns via migration 000800 instead of recreating"
  - "Fire-and-forget email pattern: IIFE with .catch() so email failures never block API responses"
  - "Plain HTML templates with inline styles instead of React Email dependency to minimize complexity"
  - "Absence alerts wired to session submit (not individual attendance marks) to batch-notify after finalization"

patterns-established:
  - "Fire-and-forget notification pattern: wrap sendEmail in IIFE with try/catch, never await in request path"
  - "Notification audit trail: always insert pending log entry before attempting send, update to sent/failed after"
  - "Lazy-init Resend client: same pattern as Stripe -- error only when RESEND_API_KEY actually needed"

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-08]

# Metrics
duration: 11min
completed: 2026-05-22
---

# Phase 4 Plan 01: Notification Infrastructure + Email Summary

**Resend SDK integration with fire-and-forget transactional emails for enrollment confirmations, payment receipts, and absence alerts -- all logged to notification_log for admin audit**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-22T23:32:00Z
- **Completed:** 2026-05-22T23:43:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Resend SDK installed with lazy-init client pattern, sendEmail() service that logs every send attempt to notification_log
- Three branded HTML email templates: enrollment confirmation, payment receipt, absence alert (purple header, DM Serif Display, Atkinson Hyperlegible, LSODance branding)
- Email triggers wired into existing routes: enrollment -> POST /enrollments, payment -> invoice.payment_succeeded webhook, absence -> POST /sessions/:id/submit
- Admin notification log view with GET /notifications API, channel filter tabs, status badges, and pagination

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification log migration + Resend SDK setup** - `4a1a868` (feat)
2. **Task 2: Email templates + trigger wiring** - `6720df8` (feat)
3. **Task 3: Notification admin view + API route** - `e80291e` (feat)

## Files Created/Modified
- `supabase/migrations/20260522000800_notification_log_columns.sql` - Adds template_key, payload, external_id, error_message columns to existing notification_log table
- `server/src/lib/notifications.ts` - Notification service: lazy-init Resend client, sendEmail() with notification_log audit
- `server/src/lib/email-templates.ts` - Plain HTML email templates with studio branding for 3 notification types
- `server/src/routes/notifications.ts` - GET /notifications admin route with org scope, pagination, channel filter
- `server/src/routes/enrollments.ts` - Wired enrollment confirmation email after successful enroll_student() RPC
- `server/src/routes/webhooks.ts` - Wired payment receipt email after invoice.payment_succeeded
- `server/src/routes/sessions.ts` - Wired absence alert emails on session submit for absent students
- `server/src/index.ts` - Registered notifications route plugin
- `server/src/types/index.ts` - Added NotificationListQuery TypeBox schema
- `server/package.json` - Added resend dependency
- `client/src/hooks/useNotifications.ts` - TanStack Query hook for GET /notifications
- `client/src/screens/admin/NotificationsPage.tsx` - Admin table view with status badges and channel filters
- `client/src/components/admin/AdminSidebar.tsx` - Added Communications NavLink after Billing
- `client/src/router.tsx` - Added /admin/communications lazy-loaded route

## Decisions Made
- Used existing notification_log table from migration 000100 and added missing columns (template_key, payload, external_id, error_message) via a new migration 000800 rather than recreating the table. The existing table already had the core structure; we only needed the extra tracking columns.
- Absence alerts fire on session submit (POST /sessions/:id/submit) rather than on individual attendance marks (PATCH /attendance). This batches notifications after the session is finalized, preventing premature alerts if a teacher corrects a mark before submitting.
- Used plain HTML email templates with inline CSS instead of adding the react-email dependency. Three templates at this stage doesn't justify the added complexity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] notification_log table already existed in migration 000100**
- **Found during:** Task 1 (notification log migration)
- **Issue:** Plan specified creating a new notification_log table, but it already existed in the base schema migration 000100 with core columns (type, recipient, subject, delivery_status, sent_at, etc.)
- **Fix:** Created migration 000800 to ALTER TABLE and add only the missing columns (template_key, payload, external_id, error_message) instead of creating the table from scratch
- **Files modified:** supabase/migrations/20260522000800_notification_log_columns.sql
- **Verification:** Migration uses IF NOT EXISTS for idempotency, server compiles cleanly
- **Committed in:** 4a1a868 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration adapted to existing schema. No scope creep.

## Issues Encountered
None

## User Setup Required

The following environment variable must be set for email sending to work:

- `RESEND_API_KEY` - Resend API key (get from https://resend.com/api-keys)
- `RESEND_FROM_EMAIL` (optional) - From address for emails (defaults to `LSODance <noreply@resend.dev>` which is Resend's test domain)

For production, configure a verified domain in Resend and set `RESEND_FROM_EMAIL` to use that domain (e.g., `LSODance <noreply@lsodance.com>`).

## Next Phase Readiness
- SMS notifications (Plan 04-02) can reuse the notification_log table and sendEmail pattern for sendSMS
- The notification service pattern (lazy-init client, fire-and-forget, log-first) is established for SMS to follow
- Parent portal (Phase 5) can leverage these email templates for parent-facing notifications
- Resend delivery webhooks could be wired in future to update notification_log delivery_status from 'sent' to 'delivered'/'bounced'

## Self-Check: PASSED

All 6 created files verified present on disk. All 3 commit hashes verified in git log.

---
*Phase: 04-communications*
*Completed: 2026-05-22*
