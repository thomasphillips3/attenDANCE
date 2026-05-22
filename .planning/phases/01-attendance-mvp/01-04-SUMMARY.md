---
phase: 01-attendance-mvp
plan: 04
subsystem: submit-flow
tags: [submit, modal, radix-ui, rfid-stub, admin-invite, password-reset, ios-safe]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [session-submit-api, rfid-stub, admin-invite, confirm-modal, submit-flow, class-checkmark, password-reset]
  affects:
    - server/src/routes/sessions.ts
    - server/src/routes/rfid.ts
    - server/src/routes/auth.ts
    - server/src/types/index.ts
    - server/src/index.ts
    - client/src/components/ConfirmModal.tsx
    - client/src/components/ClassCard.tsx
    - client/src/screens/Roster.tsx
    - client/src/screens/ClassList.tsx
    - client/src/screens/Login.tsx
    - client/src/store.ts
tech_stack:
  added: []
  patterns:
    - Radix Dialog for accessible confirmation modal (focus trap, Escape, ARIA)
    - Zustand store extended with submittedAtMap for cross-screen timestamp sharing
    - Supabase auth.admin.inviteUserByEmail via service role (never from browser)
    - 501 stub pattern for ATTN-08 RFID contract reservation
    - date-fns format() for h:mm a display of submittedAt timestamp
key_files:
  created:
    - server/src/routes/rfid.ts
    - server/src/routes/auth.ts
    - client/src/components/ConfirmModal.tsx
  modified:
    - server/src/routes/sessions.ts
    - server/src/types/index.ts
    - server/src/index.ts
    - client/src/components/ClassCard.tsx
    - client/src/screens/Roster.tsx
    - client/src/screens/ClassList.tsx
    - client/src/screens/Login.tsx
    - client/src/store.ts
decisions:
  - submittedAtMap stored in Zustand rather than passed as callback prop through component hierarchy
  - forgotMessage sentinel prefix __error__ used to distinguish error vs success state in a single string field
  - auth-routes plugin name distinct from auth plugin name to avoid Fastify plugin name collision
  - POST /sessions/:id/submit registered before GET /sessions/today to avoid Fastify route ordering conflict
metrics:
  duration: ~25 minutes
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 11
  status: awaiting-human-checkpoint
---

# Phase 1 Plan 4: Submit Flow, RFID Stub, Admin Invite, Password Reset Summary

**One-liner:** Confirmation modal via Radix Dialog, POST /sessions/:id/submit with org-scoped UPDATE, RFID 501 stub reserving ATTN-08 contract, admin-only invite endpoint, green checkmark on ClassList, and Supabase password reset link on Login.

**Status: Tasks 1 and 2 complete. Task 3 (human checkpoint) is pending.**

## What Was Built

### Task 1: Server Endpoints

**`server/src/types/index.ts`** — four new TypeBox schemas appended:
- `SubmitResponse` — `{ sessionId, status: 'completed', submittedAt }`
- `RfidCheckinBody` — `{ card_uid, device_id? }`
- `InviteBody` — `{ email, role: 'admin'|'instructor'|'front_desk' }`
- `InviteResponse` — `{ message, email }`

**`server/src/routes/sessions.ts`** — extended with `POST /sessions/:id/submit`:
- SELECT verifies session exists and belongs to requesting organization (T-04-02)
- UPDATE sets `status = 'completed'` and `updated_at = now()`
- Returns `{ sessionId, status: 'completed', submittedAt: new Date().toISOString() }`
- No `submitted_at` column needed — timestamp computed at response time
- Idempotent: repeated calls on already-completed session are no-ops

**`server/src/routes/rfid.ts`** — new Fastify plugin:
- `POST /rfid/checkin` requires valid JWT (auth preHandler runs)
- Returns 400 if `card_uid` missing from body
- Returns 501 with `"RFID check-in not yet implemented"` message + echoed `card_uid`
- No DB writes in stub mode (T-04-03: card_uid contains no PII)

**`server/src/routes/auth.ts`** — new Fastify plugin:
- `POST /auth/invite` — role gate is first check: `request.role !== 'admin'` returns 403 (T-04-01)
- Calls `fastify.supabase.auth.admin.inviteUserByEmail(email, { data: { invited: true } })`
- Uses service role client (fastify.supabase) — never exposed to browser
- Plugin named `auth-routes` (distinct from `auth` plugin) to avoid Fastify name collision

**`server/src/index.ts`** — rfidRoutes and authRoutes registered.

Server TypeScript build: 0 errors.

### Task 2: Client Submit Flow

**`client/src/components/ConfirmModal.tsx`** — new component:
- Uses `@radix-ui/react-dialog` primitives: Dialog, DialogPortal, DialogOverlay, DialogContent, DialogTitle
- Overlay: `rgba(0,0,0,0.40)` fixed inset-0 z-50
- Content: white bg, border-radius 28px, `--shadow-modal`, max-width 480px, padding 36px
- Shows `{presentCount} Present · {absentCount} Absent · {unmarkedCount} Not marked`
- Cancel: always enabled, calls `onClose()`
- Submit: disabled + CSS border spinner in `--color-purple-tint` while `isSubmitting`

**`client/src/store.ts`** — extended:
- Added `submittedAtMap: Map<string, string>` keyed by sessionId to ISO timestamp
- Added `recordSubmittedAt(sessionId, submittedAt)` action

**`client/src/screens/Roster.tsx`** — updated:
- Added `isModalOpen` and `isSubmitting` state
- Computed `unmarkedCount = students.length - Object.values(localStatus).filter(Boolean).length`
- Added sticky-bottom "Submit Attendance" button: min-height 56px, `--color-purple`, full width
- `onConfirmSubmit` handler: POST /sessions/:id/submit then `recordSubmittedAt` then `queryClient.invalidateQueries(['sessions', 'today'])` then `onBack()`
- Renders `<ConfirmModal>` with computed counts

**`client/src/components/ClassCard.tsx`** — updated:
- Added optional `submittedAt?: string` prop
- Completed badge now shows green circle checkmark (24px) + `format(new Date(submittedAt), 'h:mm a')` when `submittedAt` present, or plain "Submitted" when absent

**`client/src/screens/ClassList.tsx`** — updated:
- Reads `submittedAtMap` from Zustand store
- Passes `submittedAt={submittedAtMap.get(session.id)}` to each ClassCard

**`client/src/screens/Login.tsx`** — updated:
- Imports `supabase` from `../lib/supabase`
- Added `forgotMessage: string | null` state and `getValues` from react-hook-form
- `onForgotPassword` handler (AUTH-03):
  1. Reads email from `getValues('email')` — if empty, shows "Enter your email address first." in `--color-red`
  2. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`
  3. Shows "Check your email for a reset link." in `--color-ink-3` regardless of Supabase response
- "Forgot password?" text button: 14px, `--color-ink-3`, underline, padding 8px 0

Client `npm run build`: exits 0, 0 TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written.

**Note on store approach:** Plan offered two options for propagating `submittedAt` to ClassList — callback prop or Zustand store. Zustand was chosen because Roster calls `onBack()` immediately after submit, unmounting the component, so the timestamp must be stored outside the Roster component's lifecycle.

## Decisions Made

1. **submittedAtMap in Zustand store** rather than callback prop. Roster navigates away after submit; the timestamp must outlive the Roster component. Zustand is the natural place for cross-screen state that survives navigation.

2. **forgotMessage sentinel prefix** (`__error__`) to encode error vs success in a single `string | null` field. Avoids a second boolean state variable while keeping feedback co-located.

3. **`auth-routes` plugin name.** Fastify requires unique plugin names with `fastify-plugin`. The auth preHandler plugin is already named `auth`; naming this `auth-routes` avoids a startup crash.

4. **POST /sessions/:id/submit registered before GET /sessions/today** in sessions.ts. Fastify matches routes in registration order; placing the parameterized submit route first ensures the literal `/today` segment still matches correctly.

## Known Stubs

None — all data flows wired end-to-end. The RFID endpoint is an intentional 501 stub per ATTN-08 (Phase 2 hardware integration reserved).

## Threat Surface Scan

No new trust boundaries beyond those in the plan's threat model. All four mitigations implemented:

| Boundary | Mitigation |
|----------|-----------|
| POST /sessions/:id/submit | org verification SELECT before UPDATE (T-04-02) |
| POST /auth/invite role gate | `request.role !== 'admin'` returns 403 first (T-04-01) |
| POST /rfid/checkin stub | auth required, no DB writes, 501 returned (T-04-03) |
| inviteUserByEmail server-only | called only from Fastify service role client (T-04-01) |

## Awaiting Human Checkpoint (Task 3)

Task 3 is a `checkpoint:human-verify` gate requiring 12-step end-to-end verification on an iPad-sized viewport. See PLAN.md Task 3 for exact steps.

## Self-Check: PASSED

- `server/src/routes/rfid.ts` — exists, contains 501 stub
- `server/src/routes/auth.ts` — exists, contains admin role gate
- `server/src/routes/sessions.ts` — exists, contains POST /sessions/:id/submit
- `server/src/types/index.ts` — exists, contains SubmitResponse, RfidCheckinBody, InviteBody, InviteResponse
- `server/src/index.ts` — exists, registers rfidRoutes and authRoutes
- `client/src/components/ConfirmModal.tsx` — exists, imports @radix-ui/react-dialog
- `client/src/screens/Roster.tsx` — exists, contains "Submit Attendance" and ConfirmModal
- `client/src/screens/Login.tsx` — exists, contains resetPasswordForEmail
- `client/src/components/ClassCard.tsx` — exists, contains submittedAt prop and format()
- Commits 9319c33 (Task 1) and 4fb44c1 (Task 2) present in git log
- Client build: 0 TypeScript errors
- Server TypeScript: 0 errors
