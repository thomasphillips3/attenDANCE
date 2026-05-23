---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-02 (Reports — Enrollment, Revenue, Attendance + CSV Export)
last_updated: "2026-05-23T02:10:08.855Z"
last_activity: 2026-05-23
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad without asking for help.
**Current focus:** Phase 5 — Admin Dashboard and Operations

## Current Position

Phase: 5 of 5 (Admin Dashboard and Operations)
Plan: 3 of 4 in current phase
Status: Ready to execute
Last activity: 2026-05-23

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: ~4 hours
- Total execution time: ~4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1: Attendance MVP | 1 | ~4 hours | ~4 hours |

**Recent Trend:**

- Last 5 plans: 01-01 (4h)
- Trend: baseline established

*Updated after each plan completion*
| Phase 01-attendance-mvp P03 | 25 | 3 tasks | 6 files |
| Phase 02-studio-management P03 | 9min | 2 tasks | 8 files |
| Phase 02-studio-management P02 | 16min | 2 tasks | 14 files |
| Phase 02-studio-management P04 | 7min | 2 tasks | 9 files |
| Phase 03-billing P01 | 10min | 3 tasks | 10 files |
| Phase 03-billing P02 | 9min | 3 tasks | 9 files |
| Phase 03-billing P03 | 6min | 3 tasks | 5 files |
| Phase 03-billing P04 | 7min | 3 tasks | 5 files |
| Phase 04-communications P01 | 11min | 3 tasks | 6 files |
| Phase 04-communications P03 | 18min | 3 tasks | 12 files |
| Phase 04-communications P02 | 7min | 3 tasks | 8 files |
| Phase 04-communications P04 | 9min | 3 tasks | 6 files |
| Phase 05-admin-dashboard P02 | 6min | 3 tasks | 4 files |
| Phase 05 P03 | 11min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roles must live in `app_metadata` (server-writable only), not `user_metadata` — injected by Custom Access Token Auth Hook. Any RLS policy written against `user_metadata` role claims is a critical security bypass.
- iOS Background Sync API does not exist. Offline queue must drain on foreground reconnect (`online` event + `visibilitychange`), not background sync.
- Stripe webhook handler must return 200 immediately and process asynchronously via `webhook_events` table. Synchronous work before 200 = duplicate notifications.
- Validate Carollette's fee types (monthly tuition, registration fee, costume deposit, recital fee, sibling discount) with a 30-minute interview before writing any billing code in Phase 3.
- Start Twilio A2P 10DLC registration (brand + campaign, ~$14 one-time, 1-2 week approval) during Phase 3 at the latest — needed before Phase 4 ships SMS.
- RLS policies MUST use subselect pattern `(SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)` — bare `auth.jwt()` outside a subselect causes per-row re-evaluation (performance) and policy bypass risk.
- tsx watch --env-file flag order: `tsx watch --env-file=.env src/index.ts` — env-file flag must follow the `watch` subcommand.
- Tailwind v4 Google Fonts @import must precede `@import 'tailwindcss'` to satisfy CSS @import ordering rules.
- [Phase ?]: Roster uses default export for React.lazy compatibility; all hooks called before conditional guard return
- [Phase ?]: Storage RLS uses subselect pattern for auth.jwt() organization_id; path convention {org_id}/{student_id}/{file} for org scoping
- [Phase ?]: GET /staff co-located in classes.ts — only serves instructor picker; staff CRUD deferred to Phase 5
- [Phase ?]: WeeklyCalendar uses grid row span (hour-rounded) for MVP — sub-hour pixel precision deferred
- [Phase ?]: Snake_case API responses consumed directly in frontend -- avoids camelCase mapping bugs
- [Phase ?]: RFID card management routes (/rfid-cards) separated from Phase 1 checkin stub (/rfid/checkin)
- [Phase ?]: Student list explicitly selects columns excluding medical_notes (children's data T-02-10)
- [Phase ?]: Enrollment mutations invalidate classes queryKey broadly to refresh both list and detail enrollment counts
- [Phase ?]: RPC pattern for enrollment: check data.error for app-level errors vs Supabase error for transport/auth errors
- [Phase 3]: Soft-delete pattern for billing records (active=false) preserves audit history for tuition plans and discounts
- [Phase 3]: Inline discount creation form on BillingPage; separate TuitionPlanForm page for create/edit
- [Phase 3]: Webhook route skips auth via URL prefix check in auth.ts; raw body parser scoped to webhook plugin only
- [Phase 3]: Stripe SDK v22 type changes: payment_intent not on Invoice type, current_period_end moved to SubscriptionItem
- [Phase 3]: Stripe Smart Retries handle payment retry logic; webhook handler tracks state transitions only
- [Phase 3]: GET /billing/summary aggregates outstanding/collected/overdue for billing overview cards
- [Phase 4]: Parents are NOT staff — parent auth uses families.parent_user_id + updated custom_access_token_hook to inject role='parent', organization_id, family_id into JWT
- [Phase 4]: Magic link auth for parents via Supabase signInWithOtp — no password needed
- [Phase 4]: Notification service: fire-and-forget pattern, lazy-init SDK clients, catch errors and log to notification_log
- [Phase 4]: Email templates are plain HTML (no React Email dependency) with studio branding
- [Phase 4]: SMS requires A2P 10DLC registration before production use (brand + campaign, ~$14, 1-2 week approval)
- [Phase 4]: Stripe Elements (embedded) for parent invoice payment — PaymentIntent created server-side, clientSecret returned to frontend
- [Phase 4]: Broadcast endpoint supports channel=email|sms|both with optional classIds filter for targeted sends
- [Phase 5]: CSV export uses client-side Blob creation from API rows array (no server-side CSV generation)
- [Phase 5]: Attendance rate = (present + late) / total records, consistent with dashboard KPI definition
- [Phase ?]: Staff API plugin named 'staff-portal' to avoid conflict with GET /staff in classes.ts
- [Phase ?]: Instructor staff record resolved via user_id lookup on each request
- [Phase ?]: Hours endpoint returns calculated pay inline (total_hours * hourly_rate)

### Pending Todos

- Start Twilio A2P 10DLC registration (brand + campaign) before deploying SMS to production

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-23T02:10:08.848Z
Stopped at: Completed 05-02 (Reports — Enrollment, Revenue, Attendance + CSV Export)
Resume file: None
