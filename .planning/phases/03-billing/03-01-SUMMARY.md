---
phase: 3
plan: 1
subsystem: billing
tags: [stripe, tuition-plans, discounts, crud, admin-ui]
dependency_graph:
  requires: [02-01, 02-02, 02-03, 02-04]
  provides: [tuition-plan-crud, discount-crud, stripe-sdk]
  affects: [billing-page, admin-sidebar, router]
tech_stack:
  added: [stripe@22.x]
  patterns: [soft-delete, inline-form, admin-role-gate, org-scope]
key_files:
  created:
    - server/src/routes/billing.ts
    - client/src/hooks/useTuitionPlans.ts
    - client/src/hooks/useDiscounts.ts
    - client/src/screens/admin/BillingPage.tsx
    - client/src/screens/admin/TuitionPlanForm.tsx
  modified:
    - server/package.json
    - server/src/types/index.ts
    - server/src/index.ts
    - client/src/components/admin/AdminSidebar.tsx
    - client/src/router.tsx
decisions:
  - Soft-delete pattern for tuition plans and discounts (active=false) preserves billing audit history
  - Inline discount creation form on BillingPage rather than separate page (fewer clicks for Mrs. Goodman)
  - Tuition plans get a dedicated form page (TuitionPlanForm) since they have class selection and edit mode
metrics:
  duration: 10min
  completed: 2026-05-22
---

# Phase 3 Plan 1: Stripe SDK + Tuition Plan & Discount CRUD Summary

Admin can create and manage tuition plans per class (monthly/per-session/seasonal) and apply sibling, scholarship, or staff discounts to families -- the pricing foundation that invoice generation depends on.

## What Was Built

### Task 1: Stripe SDK + Billing Types (ca9b06e)
- Installed `stripe` npm package in server
- Added TypeBox schemas: `CreateTuitionPlanBody`, `UpdateTuitionPlanBody`, `CreateDiscountBody`, `UpdateDiscountBody`
- Tuition plan intervals: monthly, per_session, seasonal
- Discount types: sibling, scholarship, staff
- Discount amount XOR percent constraint reflected in schema

### Task 2: Server Routes (bff9975)
- Created `server/src/routes/billing.ts` with fastify-plugin pattern
- Tuition plan endpoints: GET (list with ?classId filter), GET /:id, POST, PATCH /:id, DELETE /:id
- Discount endpoints: GET (list with ?familyId and ?classId filters), POST, PATCH /:id, DELETE /:id
- Admin role gate on all mutations
- Organization scope on every query
- Foreign key verification for class_id and family_id before insert/update
- Amount XOR percent validation on discount creation
- Soft-delete pattern: DELETE sets active=false
- Joined class names on tuition plan queries, joined family/class names on discount queries
- Registered billing routes in server/src/index.ts

### Task 3: Client Hooks and Pages (de4dd29)
- `useTuitionPlans` hook: list, detail, create, update, delete mutations with query invalidation
- `useDiscounts` hook: list, create, update, delete mutations with query invalidation
- `BillingPage`: two-section admin page with tuition plans table and discounts table
  - Tuition plans table: Class Name, Amount, Interval, Status, Edit/Deactivate actions
  - Discounts table: Family/Class, Type, Amount/Percent, Status, Deactivate action
  - Inline discount creation form with family/class dropdowns, type, mode (amount/percent), value
  - Deactivation confirmation dialog (Radix Dialog) for both plans and discounts
- `TuitionPlanForm`: create/edit form with class dropdown, amount input, billing interval select
  - Uses react-hook-form + zod validation
  - Edit mode loads existing plan data
- Added "Billing" NavLink to AdminSidebar between Classes and Attendance
- Added routes: /admin/billing, /admin/billing/plans/new, /admin/billing/plans/:id

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Soft-delete for billing records:** DELETE endpoints set `active=false` rather than removing rows, preserving billing history for future audit and reporting needs.
2. **Inline discount form:** Discount creation uses an inline expandable form on BillingPage rather than a separate route, reducing navigation overhead for the admin.
3. **Tuition plan form as separate page:** Unlike discounts, tuition plans get a dedicated form page because they support both create and edit modes with class selection.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| T-03-01-01 | ca9b06e | Install Stripe SDK and add billing TypeBox schemas |
| T-03-01-02 | bff9975 | Add tuition plan and discount CRUD server routes |
| T-03-01-03 | de4dd29 | Add billing admin pages with tuition plan and discount management |
