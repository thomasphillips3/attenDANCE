# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad without asking for help.
**Current focus:** Phase 1 — Attendance MVP

## Current Position

Phase: 1 of 5 (Attendance MVP)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-05-21 — Roadmap created; all 55 v1 requirements mapped across 5 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roles must live in `app_metadata` (server-writable only), not `user_metadata` — injected by Custom Access Token Auth Hook. Any RLS policy written against `user_metadata` role claims is a critical security bypass.
- iOS Background Sync API does not exist. Offline queue must drain on foreground reconnect (`online` event + `visibilitychange`), not background sync.
- Stripe webhook handler must return 200 immediately and process asynchronously via `webhook_events` table. Synchronous work before 200 = duplicate notifications.
- Validate Carollette's fee types (monthly tuition, registration fee, costume deposit, recital fee, sibling discount) with a 30-minute interview before writing any billing code in Phase 3.
- Start Twilio A2P 10DLC registration (brand + campaign, ~$14 one-time, 1-2 week approval) during Phase 3 at the latest — needed before Phase 4 ships SMS.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-21
Stopped at: Roadmap created and written. REQUIREMENTS.md traceability updated. Ready for /gsd:plan-phase 1.
Resume file: None
