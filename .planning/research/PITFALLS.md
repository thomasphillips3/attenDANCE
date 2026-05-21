# Domain Pitfalls

**Domain:** Dance studio management SaaS — attendance, enrollment, billing, RFID, PWA
**Researched:** 2026-05-21
**Confidence:** HIGH (most pitfalls verified with official docs or multiple sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or a security incident.

---

### Pitfall 1: Offline Queue Syncs Out of Sequence and Corrupts Attendance State

**What goes wrong:** The IndexedDB queue fires sync requests in whatever order connectivity returns. An "absent" mark queued while offline arrives at the server after a manual correction made online, overwriting the correct value. Attendance records silently regress.

**Why it happens:** Developers build the queue as a simple FIFO append list and assume the server receives events in the order they were made. Network resumption fires everything at once with no causal ordering.

**Consequences:** Attendance records are wrong. Mrs. Goodman's confirmed checks disappear. The studio does not know who was in class. Trust in the system collapses quickly.

**Prevention:**
- Assign a monotonic sequence number (or `created_at` with millisecond precision) to every queued operation at creation time, stamped at write time not sync time.
- Send operations to the server in sequence order, not dispatch order.
- The server endpoint must validate sequence: if it receives operation N+2 before N+1, it must reject or queue N+2 until N+1 arrives.
- Use Last-Write-Wins only within a single student-class-date combination, and only when each write carries a timestamp stamped offline at write time.

**Detection:** Build a test fixture that queues three edits offline (mark present, then absent, then late) and reconnects with a simulated delayed network. Verify the final state is "late," not whichever arrived first.

**Phase:** Offline sync implementation (PWA/attendance phase). Get ordering right before writing a single line of IndexedDB code.

---

### Pitfall 2: iOS Safari Clears the Offline Cache After 7 Days of Inactivity

**What goes wrong:** Mrs. Goodman takes a week off (holiday break, sick). When she returns, the PWA's service worker cache has been evicted by iOS. She opens the app, the studio Wi-Fi is flaky, and she gets a white screen instead of the class roster.

**Why it happens:** iOS/Safari enforces a 7-day expiry on script-writable storage (including service worker caches) if the origin is not accessed within that window. This is not configurable — it is an OS-level policy as of iOS 13.4+ and remains in effect as of iOS 26.

**Consequences:** The attendance-in-30-seconds core value is broken on the exact device this system is built for.

**Prevention:**
- On every successful PWA open, force a service worker update check: `navigator.serviceWorker.getRegistration().then(reg => reg?.update())`.
- Pre-cache only the minimal shell (HTML, critical JS, CSS). Roster data is fetched fresh and falls back to IndexedDB, not service worker cache — IndexedDB survives the 7-day eviction better than cache storage.
- Populate IndexedDB with today's class rosters at login time so offline fallback comes from IndexedDB, not the service worker cache.
- Show a clear "You're offline — showing last synced data" banner when network is unavailable.

**Detection:** On a real iPad, add the PWA to the home screen, use it once, do not open it for 8 days, then reopen with airplane mode on. A white screen means the caching strategy is wrong.

**Phase:** PWA setup (day one of offline implementation). Not something to retrofit after the queue is built.

---

### Pitfall 3: Background Sync API Does Not Exist on iOS — Queued Operations Never Fire

**What goes wrong:** Developer registers a `sync` event in the service worker using the Background Sync API. On Android Chrome it works perfectly. On the studio iPad (iOS Safari), the service worker `sync` event never fires because Background Sync is not implemented on iOS as of 2026.

**Consequences:** Attendance marked offline never reaches the server unless the user actively has the app open when connectivity returns. Silently lost data with no error message.

**Prevention:**
- Do not use the Background Sync API at all. Treat it as non-existent for this project.
- Implement a foreground sync trigger: on the `online` event and on every app focus event (`visibilitychange`), scan the IndexedDB queue and flush pending operations.
- Show a visible "X records pending sync" indicator in the UI so Mrs. Goodman knows the queue is non-empty.
- Design the system around the constraint that sync only happens when the app is open and online.

**Detection:** Check `'SyncManager' in window` on the target iPad. It will return `false`.

**Phase:** PWA/offline phase. The absence of Background Sync on iOS must be a first-class design constraint, not a discovery at QA.

---

### Pitfall 4: Supabase RLS Policy Uses `raw_user_meta_data` for Role Authorization

**What goes wrong:** Roles (admin, instructor, front_desk) are stored in `raw_user_meta_data` in the Supabase Auth JWT. RLS policies check `auth.jwt() -> 'user_metadata' -> 'role'`. A parent modifies their own JWT metadata via the Supabase client SDK and grants themselves instructor or admin role.

**Why it happens:** `raw_user_meta_data` is writable by the authenticated user. The Supabase JS client exposes `supabase.auth.updateUser({ data: { role: 'admin' } })` and this is not blocked by default.

**Consequences:** A parent can read or modify any student's data, access billing information, or take admin actions. A complete authorization bypass requiring no hacking skill — just reading the SDK docs.

**Prevention:**
- Store roles in a server-controlled location: a `user_roles` database table or `app_metadata` (not user-writable).
- Use a Custom Access Token Auth Hook to inject the role into the JWT from `app_metadata` at sign-in time.
- RLS policies check `auth.jwt() -> 'app_metadata' -> 'role'` or query the `user_roles` table directly.
- Never expose `updateUser` to clients in a way that can modify authorization-bearing fields.

**Detection:** As a parent user, call `supabase.auth.updateUser({ data: { role: 'admin' } })`. If the role appears in subsequent JWT claims and changes access, the implementation is vulnerable.

**Phase:** Auth/RLS setup (Phase 1). This is a security-critical decision that cannot be retrofitted without touching every RLS policy.

---

### Pitfall 5: Missing `organization_id` Filter in a Single Query Leaks All Tenant Data

**What goes wrong:** When future studios are added, one query somewhere — a report, a webhook handler, a background job — is missing `WHERE organization_id = $1`. That query returns every student from every studio to whoever made the request.

**Why it happens:** Developer discipline does not scale. When every query must manually include a filter, eventually one is forgotten. Most likely in background jobs, admin reports, and analytics queries that feel "internal" and are written quickly.

**Consequences:** A future studio owner can see LaShelle's student roster. This is PII of minors. A regulatory and trust catastrophe.

**Prevention:**
- Enable RLS on every table from day one. RLS enforces `organization_id` at the database level regardless of what the application layer does.
- Set a default RLS policy that denies all access, then grant explicitly. Never rely on application code to remember to filter.
- In the Fastify backend, set `organization_id` via a database session variable at connection time using `SET LOCAL app.current_org_id = ?` and reference `current_setting('app.current_org_id')` in RLS policies. A forgotten application-layer filter still hits the RLS wall.
- Write an automated test: create two test organizations, issue a query with org A's credentials, and assert zero rows from org B are returned.

**Detection:** After creating two test organizations, issue a raw Postgres query with org A's session context but without an explicit `organization_id` filter. If org B's data appears, RLS is not doing its job.

**Phase:** Database schema/RLS (Phase 1). Foundational. Adding it later requires migrating every table and rewriting every policy.

---

### Pitfall 6: Stripe Webhook Handler Does Heavy Work Synchronously and Times Out

**What goes wrong:** The webhook handler for `invoice.payment_failed` synchronously queries the database, sends an SMS via Twilio, and sends an email via Resend before returning a 200. On a Railway cold start, this takes 22 seconds. Stripe expects a 200 within 20 seconds, marks the webhook as failed, and retries. The SMS and email are sent twice.

**Why it happens:** The straightforward implementation does everything in the handler. Works fine in dev where latency is near-zero. Only fails in production under cold starts or external service latency.

**Consequences:** Duplicate SMS/email notifications. Parent gets two "payment failed" texts and calls the studio furious. Stripe marks the endpoint as unreliable and throttles future webhooks.

**Prevention:**
- Acknowledge the webhook immediately (return 200 with empty body) and process asynchronously.
- Write the incoming event to a `webhook_events` table on receipt, return 200, then process via a background worker or Supabase Edge Function triggered by a database insert.
- Enforce idempotency: store `stripe_event_id` with a unique constraint. On duplicate delivery, the insert fails gracefully and the second handler exits early without processing.
- Always verify Stripe webhook signatures with `stripe.webhooks.constructEvent` before persisting anything.

**Detection:** Use the Stripe CLI to replay a webhook event twice in rapid succession (`stripe trigger invoice.payment_failed`). If downstream effects happen twice, idempotency is broken.

**Phase:** Billing phase. Must be designed this way from the start — retrofitting idempotency after duplicate charges have occurred is a painful and trust-damaging process.

---

### Pitfall 7: Stripe Subscription Lifecycle Has Five States, Not Two

**What goes wrong:** The application treats subscriptions as either `active` or `canceled`. Parents in `past_due`, `unpaid`, `incomplete`, or `trialing` states get either full access or no access — neither of which is correct.

**Why it happens:** The happy path only exercises `active`. States like `past_due` only appear when a payment fails, which never happens in dev testing with `4242 4242 4242 4242`.

**Consequences:** A parent whose payment failed continues to enroll students in classes (revenue loss) or is wrongly locked out of the portal during a temporary card issue (support calls to Carollette that she does not have time for).

**Prevention:**
- Define explicit access rules for all five states before writing a line of access control logic:
  - `active`: Full access.
  - `trialing`: Full access (if trials are used).
  - `past_due`: Portal access, prominent payment banner, block new enrollments.
  - `unpaid`: Read-only portal, no enrollments, trigger dunning sequence.
  - `incomplete`: Treat as `past_due` until charge resolves.
  - `canceled`: Read-only access to history, no active enrollments.
- Listen to `customer.subscription.updated` and `invoice.payment_failed` webhooks to drive state transitions.
- Test every state using Stripe's test card numbers for declined payments (e.g., `4000 0000 0000 0341`).

**Detection:** Use Stripe test mode to trigger a failed payment. Verify the parent's access level changes correctly in the application and does not simply show an error page.

**Phase:** Billing phase. Define the state machine before writing any access control logic.

---

## Moderate Pitfalls

---

### Pitfall 8: RLS Calls `auth.uid()` Per-Row Instead of Caching It

**What goes wrong:** RLS policies call `auth.uid()` directly inside the policy expression. PostgreSQL evaluates this function for every row scanned, causing measured 10x–11x slowdowns on larger tables.

**Prevention:**
- Wrap in a subselect: `(select auth.uid())` instead of `auth.uid()`. PostgreSQL caches the subselect result for the duration of the query.
- Apply the same pattern to `auth.jwt()` and any function called in policy expressions.
- Run `EXPLAIN ANALYZE` on the most common queries (today's classes, roster fetch) with RLS enabled and verify no sequential scans on attendance or enrollment tables.

**Phase:** RLS implementation. Low effort, high impact. Apply from day one when writing policies.

---

### Pitfall 9: RFID Reader Fires Duplicate Scan Events When Card Lingers Near Reader

**What goes wrong:** A student holds their card near the RC522 reader a half-second too long. The reader fires 3–5 read events for the same UID in quick succession. Each event hits the `/rfid/checkin` endpoint and creates duplicate attendance records, or triggers duplicate notifications.

**Prevention:**
- Implement a deduplication window in the Pi's Python script: suppress reads for the same UID within 2–3 seconds.
- The `/rfid/checkin` server endpoint must also be idempotent: `INSERT INTO attendance ... ON CONFLICT (student_id, class_id, date) DO NOTHING` (or `DO UPDATE SET check_in_method = 'rfid', updated_at = now()`).
- Log every RFID scan event with a timestamp regardless of whether the attendance record was created, for audit purposes.

**Phase:** RFID integration phase. Both deduplication layers are required — Pi layer reduces noise, server layer is the authoritative guard.

---

### Pitfall 10: Stripe Creates an Unexpected Immediate Charge on Mid-Month Enrollment

**What goes wrong:** A student enrolls in a new class on the 15th. Stripe's default behavior generates an immediate prorated invoice for the remaining days of the month, then charges the full amount on the 1st. The parent sees two charges in two weeks and calls the studio alarmed.

**Why it happens:** Stripe's default `proration_behavior` is `'create_prorations'` when adding items to a subscription mid-cycle. This is technically correct but behaviorally surprising to dance studio parents.

**Prevention:**
- Decide on proration strategy before writing billing code. For most dance studios, "start billing on next cycle" is the right policy for mid-month enrollments.
- Use `proration_behavior: 'none'` when adding subscription items mid-cycle if no proration is desired.
- Show parents a billing preview before confirming enrollment (Stripe's `subscription.update` API supports a `preview` mode via the Upcoming Invoices endpoint).
- If proration is used, document it clearly before the parent confirms.

**Detection:** Create a test subscription, add a new class item on the 15th, and check whether an immediate charge appears on the test customer's invoice list.

**Phase:** Billing phase, specifically the enrollment-to-billing flow. Requires a policy decision from Carollette before implementation.

---

### Pitfall 11: JWT Role Claims Are Stale After an Admin Demotes a Staff Member

**What goes wrong:** Carollette demotes a front desk employee after a staffing change. The employee's JWT still contains `role: front_desk` until it expires (Supabase default: 1 hour). For that hour, the former employee retains full front-desk access.

**Why it happens:** JWTs are stateless. Changing a database value does not invalidate existing tokens already issued.

**Prevention:**
- Use short JWT expiry (15–30 minutes) for staff accounts.
- For immediate revocation (termination, security incident), use `supabase.auth.admin.signOut(userId, 'others')` to invalidate all existing sessions for that user immediately.
- On sensitive mutations (enrollment changes, billing actions), perform a secondary role check against the `user_roles` database table rather than relying solely on the JWT claim.
- Document this limitation in the admin UI: "Role changes take effect within 30 minutes or when the user next logs in."

**Phase:** Auth/role management. Acceptable limitation for a small studio; document it explicitly so Carollette knows to log a dismissed employee out immediately.

---

### Pitfall 12: Service Worker Update Cycle Leaves iPad Running a Stale App Version

**What goes wrong:** A critical bug fix is deployed. Mrs. Goodman's iPad continues running the old service worker because Safari has cached it aggressively. She reports the bug as "still broken" even though the fix is live. Debugging becomes confusing because the deployed code and the running code are different.

**Prevention:**
- Force an update check on every app open (see Pitfall 2 pattern: `reg?.update()`).
- Use versioned cache names (e.g., `attendance-cache-v1.2.3`). On service worker `activate`, delete all caches whose name does not match the current version.
- Detect a waiting service worker (`registration.waiting !== null`) and show a "New version available — tap to update" banner that calls `registration.waiting.postMessage({ type: 'SKIP_WAITING' })`.

**Phase:** PWA infrastructure. Set up correctly in the initial service worker implementation so all future deployments benefit automatically.

---

### Pitfall 13: Billing Model Does Not Match How Dance Studios Actually Charge

**What goes wrong:** The system implements generic SaaS subscription billing. Dance studios charge by class per month, charge differently for students in multiple classes, and have registration fees, costume deposits, recital fees, and sibling discounts — none of which map cleanly to a simple subscription item.

**Why it happens:** Developer models billing after familiar SaaS patterns rather than understanding how Carollette actually invoices families.

**Consequences:** The billing system is technically functional but operationally wrong. Carollette has to manually correct every invoice. She abandons the system and goes back to Jackrabbit.

**Prevention:**
- Before writing billing code: interview Carollette about every fee type: monthly tuition per class, annual registration fee, costume deposit, recital fee, late payment fee, sibling discount.
- Map each fee type to the correct Stripe primitive:
  - Monthly tuition per class → subscription item (one per enrolled class)
  - Annual registration fee → one-time invoice item added at enrollment
  - Costume deposit → one-time invoice item (track refundability separately)
  - Recital fee → one-time invoice item added per event
  - Sibling discount → negative invoice item or a Stripe coupon
- Use `subscription_schedules` if the season runs September–May with a summer break.

**Phase:** Billing requirements phase, before any coding. This is a requirements-gathering problem. One 30-minute conversation with Carollette prevents weeks of rework.

---

## Minor Pitfalls

---

### Pitfall 14: Attendance Mark Requires a Network Round-Trip Before UI Confirms

**What goes wrong:** Mrs. Goodman taps "Present" for a student. The button spins waiting for a server response before confirming. 30 students at 2 seconds each equals at least a minute for a single class. The core value — full class attendance in under 30 seconds — is broken.

**Prevention:**
- Apply optimistic UI updates: update local React state immediately on tap, write to IndexedDB immediately, sync to server in the background.
- If sync fails, surface a clear error state (the row goes visually distinct with a retry affordance) rather than silently reverting.

**Phase:** Attendance UI phase. Optimistic updates must be designed in from the start — they change how the entire attendance component is architected (local state as source of truth, server as sync target).

---

### Pitfall 15: Stripe Customer Portal Default Settings Allow Parents to Cancel Mid-Season

**What goes wrong:** The Stripe Customer Portal is enabled with default settings. A parent self-cancels their subscription on April 1st, two months before the recital. The studio loses revenue and already has a costume ordered for that student.

**Prevention:**
- Configure the Customer Portal explicitly: disable self-serve cancellation.
- Route cancellation requests to a "contact the studio" flow that notifies Carollette by email so she can handle it manually with the family.
- If self-serve cancellation is eventually offered, enforce the studio's cancellation policy (e.g., 30-day notice required, costume deposits non-refundable) in the cancellation flow before Stripe processes it.

**Phase:** Billing/portal phase. Configure the Customer Portal options deliberately, not with defaults.

---

### Pitfall 16: Costume Tracking Uses Booleans Instead of a Defined State Machine

**What goes wrong:** Costumes are tracked with an `ordered` boolean. As the recital approaches, the studio needs to know: ordered, arrived, distributed, fitted, altered, returned (for rentals). The boolean proliferates into multiple columns with inconsistent semantics across the codebase.

**Prevention:**
- Define costume status as a Postgres enum from day one: `not_ordered | ordered | arrived | distributed | fitted | returned`.
- Add `status_updated_at` and `status_updated_by` columns for audit trail.
- Do not add columns; add states to the enum as requirements emerge.

**Phase:** Recital management phase. Low cost to get right upfront; a painful migration if tracked incorrectly.

---

### Pitfall 17: Family Model Conflates Billing Contact With Portal Login

**What goes wrong:** A family has multiple adults. Dad's email is the billing contact (used for Stripe and invoice emails). Mom wants to log into the parent portal to see class schedules. There is no account for mom's email. She contacts the studio; Mrs. Goodman has no idea how to add a second parent login.

**Why it happens:** The data model treats "family" as a single email address. Dance studios commonly have one billing party but multiple guardians who need portal visibility.

**Prevention:**
- Design the family model to support multiple guardians per family, each with their own portal login (`guardians` table with foreign key to `families`).
- The billing email (used for Stripe Customer) is on the `families` record; portal credentials are on the `guardians` record.
- Define explicitly which email receives billing communications (Stripe), class communications (Resend), and absence alerts (Twilio) — these need not be the same address.

**Phase:** Data model phase (Phase 1). The family/guardian model must be defined before building the parent portal — retrofitting multiple guardian accounts later requires schema changes and data migration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| PWA/offline setup | iOS 7-day cache eviction (Pitfall 2), no Background Sync API (Pitfall 3) | Design sync strategy for iOS-only constraints from day one |
| Offline queue implementation | Out-of-sequence sync corrupts state (Pitfall 1) | Timestamp at write time, sequence-ordered flush |
| Auth and RLS | `raw_user_meta_data` role bypass (Pitfall 4), stale JWT after demotion (Pitfall 11) | Use `app_metadata` + Custom Access Token Hook |
| Database schema | Missing `organization_id` leaks tenant data (Pitfall 5), per-row `auth.uid()` (Pitfall 8) | RLS on all tables from day one; cache `auth.uid()` in subselect |
| Stripe billing integration | 5-state lifecycle (Pitfall 7), webhook timeout/duplicates (Pitfall 6), unexpected proration charge (Pitfall 10) | State machine before access control; idempotent webhooks; decide proration policy before coding |
| Billing requirements gathering | Fee types do not map to generic SaaS billing (Pitfall 13) | Interview Carollette before writing billing code |
| Stripe Customer Portal | Parents can self-cancel mid-season (Pitfall 15) | Configure portal options explicitly; disable self-serve cancellation |
| RFID integration | Duplicate scans from card lingering (Pitfall 9) | Dedup on Pi + idempotent server `ON CONFLICT` |
| Attendance UI | Network round-trip blocks tap confirmation (Pitfall 14) | Optimistic UI with IndexedDB as source of truth |
| Recital management | Costume state machine undefined (Pitfall 16) | Define Postgres enum before building UI |
| Family/guardian data model | Single email conflates billing and portal login (Pitfall 17) | Separate `guardians` table with individual portal logins |
| Service worker deployments | Stale app version on update (Pitfall 12) | Versioned cache names, surface update banner |

---

## Sources

- [Offline Sync and Conflict Resolution Patterns — Sachith Dassanayake (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/)
- [PWA iOS Limitations and Safari Support — MagicBell (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [5 Things We Got Wrong About Stripe Billing — DEV Community](https://dev.to/obsidiancladlabs/5-things-we-got-wrong-about-stripe-billing-3439)
- [5 Stripe Dunning Best Practices — DEV Community](https://dev.to/diven_rastdus_c5af27d68f3/5-stripe-dunning-best-practices-that-recover-40-of-failed-payments-ibp)
- [Stripe Subscription Webhooks — Official Stripe Docs](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Prorations — Official Stripe Docs](https://docs.stripe.com/billing/subscriptions/prorations)
- [Supabase RLS Best Practices — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase Custom Claims and RBAC — Official Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Row Level Security — Official Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Multi-Tenant SaaS Mistakes — Medium/@Fahad06](https://medium.com/@Fahad06/multi-tenant-saas-mistakes-ill-never-make-again-ef358e1feb9f)
- [Multi-Tenant Leakage When RLS Fails — Medium/@instatunnel](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Building Production-Grade Idempotency with Fastify — Medium](https://javascript.plainenglish.io/building-production-grade-idempotency-with-node-js-fastify-and-redis-4876de266222)
- [Dance Studio Scheduling Mistakes — DanceStudioManager.com](https://www.dancestudiomanager.com/dance-studio-scheduling-mistakes/)
- [Jackrabbit Class Proration Help — Official Jackrabbit Docs](https://help.jackrabbitclass.com/help/prorate-tuition-fees)
- [RFID Problems and Solutions — RFIDCard.com](https://www.rfidcard.com/top-rfid-problems-and-proven-solutions-a-complete-troubleshooting-guide/)
