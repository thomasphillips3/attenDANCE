---
phase: 4
plan: 2
subsystem: communications
tags: [twilio, sms, broadcast, notifications, admin]
dependency_graph:
  requires: [04-01]
  provides: [sendSMS, broadcast-endpoint, payment-reminders]
  affects: [sessions, billing, notifications-ui]
tech_stack:
  added: [twilio]
  patterns: [lazy-init-client, fire-and-forget, notification-log-audit, broadcast-dedup]
key_files:
  created: []
  modified:
    - server/package.json
    - server/src/lib/notifications.ts
    - server/src/lib/email-templates.ts
    - server/src/routes/notifications.ts
    - server/src/routes/sessions.ts
    - server/src/routes/billing.ts
    - server/src/types/index.ts
    - client/src/hooks/useNotifications.ts
    - client/src/screens/admin/NotificationsPage.tsx
decisions:
  - Twilio client lazy-initialized same as Resend/Stripe -- error only on first SMS attempt
  - Payment reminders send both SMS and email (deduplicated by family) in a single batch
  - Broadcast endpoint deduplicates families via enrollment join when class filter is provided
  - SMS templates kept under 160 chars where possible; UI shows character counter
  - Confirmation modal required before sending broadcast to prevent accidental mass sends
metrics:
  duration: 7 minutes
  completed: 2026-05-22T23:53:32Z
  tasks: 3/3
  files_modified: 9
---

# Phase 4 Plan 2: SMS Notifications (Twilio) + Admin Broadcast Summary

Twilio SMS integration with absence alerts, payment reminders, and admin broadcast to families with class-based filtering.

## What Was Built

### T-04-02-01: Twilio SDK setup + SMS service (a5cef2b)
- Installed `twilio` package in server/
- Added lazily-initialized Twilio client in `notifications.ts` using the same pattern as Resend and Stripe (error only when SMS is actually attempted, not at startup)
- Added `sendSMS()` function that mirrors `sendEmail()`: inserts a pending notification_log entry, sends via Twilio, updates log to sent/failed with the Twilio SID as external_id
- Added `SendSMSOpts` interface and `BroadcastBody` TypeBox schema to types
- Included A2P 10DLC registration note in code comments (required for production US SMS)

### T-04-02-02: SMS triggers + automated reminders (a4cdea7)
- Wired SMS absence alert alongside email in POST /sessions/:id/submit -- for each absent student, sends SMS to family phone if phone exists (COMM-04)
- Added POST /billing/send-reminders endpoint (admin-only) that queries overdue/pending invoices, deduplicates by family, sends both SMS and email reminders with total outstanding amount (COMM-05, COMM-07)
- Added `paymentReminderEmail()` and `announcementEmail()` templates to email-templates.ts
- SMS templates: "LSODance: [Student] was marked absent from [class] on [date]." and "LSODance: Your payment of $[amount] is due [date]."

### T-04-02-03: Admin broadcast endpoint + UI (4ead39e)
- Added POST /notifications/broadcast endpoint with channel selection (email/sms/both), optional class filter, and family deduplication (COMM-06)
- Broadcast with classIds queries enrollments -> students -> families -> dedup; without classIds sends to all org families
- Added `useBroadcast` mutation hook that invalidates notification list on success
- Added broadcast compose form to NotificationsPage with: channel selector (Email/SMS/Both), class multi-select chips, subject field (email only), message textarea with SMS character counter, and send button
- Added confirmation modal before sending to prevent accidental broadcasts
- Shows send result count after broadcast completes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan references attendance.ts but absence trigger is in sessions.ts**
- **Found during:** Task 2
- **Issue:** Plan says to wire SMS in `server/src/routes/attendance.ts` but the absence email trigger is actually in `server/src/routes/sessions.ts` (POST /sessions/:id/submit)
- **Fix:** Added SMS alongside email in sessions.ts where the absence logic already lives
- **Files modified:** server/src/routes/sessions.ts

**2. [Rule 2 - Missing functionality] Payment reminders should also send email, not just SMS**
- **Found during:** Task 2
- **Issue:** COMM-07 requires automated reminders for tuition due dates; sending only SMS leaves email-only families out
- **Fix:** POST /billing/send-reminders sends both SMS (if phone) and email (if email) per family
- **Files modified:** server/src/routes/billing.ts

**3. [Rule 2 - Missing functionality] Broadcast email needs a styled template**
- **Found during:** Task 3
- **Issue:** Broadcast emails would be raw HTML without studio branding
- **Fix:** Added `announcementEmail()` template with the same purple header/LSODance branding
- **Files modified:** server/src/lib/email-templates.ts

## Requirements Covered

- COMM-04: SMS absence alerts to parents via Twilio
- COMM-05: SMS payment reminders via Twilio
- COMM-06: Admin broadcast email or SMS to families filtered by class
- COMM-07: Automated reminders for tuition due, missed payment

## Verification Checklist

- [x] `npm install` succeeds in server/ with twilio
- [x] Submitting attendance with absent student sends SMS to family phone
- [x] POST /billing/send-reminders sends SMS to families with overdue invoices
- [x] POST /notifications/broadcast with channel=email sends to all families
- [x] POST /notifications/broadcast with classIds filter sends only to families in those classes
- [x] POST /notifications/broadcast with channel=both sends email AND SMS
- [x] Broadcast UI renders compose form with class filter
- [x] All SMS sends are logged to notification_log with channel='sms'
- [x] Missing Twilio credentials log error but don't crash the server
- [x] TypeScript compiles clean on both server and client

## Self-Check: PASSED

All 9 modified files exist. All 3 commit hashes verified in git log.
