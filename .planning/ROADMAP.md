# Roadmap: LSODance Studio Platform

## Overview

Five phases that build from the front desk outward. Phase 1 delivers the core value — Mrs. Goodman takes attendance in under 30 seconds — on top of a multi-tenant schema and auth foundation that every later phase depends on. Phase 2 adds the studio management layer (students, families, classes, enrollment) that gives attendance its roster. Phase 3 wires in recurring billing via Stripe. Phase 4 opens the parent portal and activates communications. Phase 5 completes the admin surface: dashboard, reports, staff portal, and recital/event management.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Attendance MVP** - Auth, multi-tenant schema, and the full Mrs. Goodman attendance flow — offline-first, iPad-ready
- [ ] **Phase 2: Studio Management** - Students, families, classes, enrollment, and waitlist — the data that feeds the roster
- [ ] **Phase 3: Billing** - Stripe recurring billing, invoices, payment tracking, and discounts
- [ ] **Phase 4: Communications and Parent Portal** - Transactional email, SMS, and the parent-facing portal
- [ ] **Phase 5: Admin Dashboard and Operations** - KPI dashboard, reports, staff portal, and event/recital management

## Phase Details

### Phase 1: Attendance MVP
**Goal**: Mrs. Goodman can log in on an iPad, open today's classes, mark attendance for a full class in under 30 seconds, and submit — even when the studio WiFi is down.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ATTN-01, ATTN-02, ATTN-03, ATTN-04, ATTN-05, ATTN-06, ATTN-07, ATTN-08, ATTN-09, INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. A staff member can log in with email and password on an iPad and their session persists across browser refresh
  2. The front desk sees today's classes with done/pending/in-progress status and can tap into any class roster
  3. Every student row has 56px+ tap targets; marking all students present, absent, late, or excused takes under 30 seconds for a class of 15
  4. Attendance marks survive closing the browser tab — the offline queue syncs automatically when WiFi reconnects, with a visible "X records pending" indicator
  5. Submitted attendance shows a confirmation modal then a checkmark and timestamp on the home screen
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Walking skeleton: Supabase schema + RLS + Auth Hook + Fastify scaffold + Vite PWA login
- [x] 01-02-PLAN.md — Class list and roster display with IndexedDB caching
- [x] 01-03-PLAN.md — Attendance marking with offline queue and OfflineBanner
- [ ] 01-04-PLAN.md — Submit confirmation, RFID stub, admin invite, password reset

**UI hint**: yes

### Phase 2: Studio Management
**Goal**: Admin can create and manage students, families, classes, and enrollments — giving the attendance roster its data and enabling class scheduling across the studio week.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: STUD-01, STUD-02, STUD-03, STUD-04, STUD-05, CLAS-01, CLAS-02, CLAS-03, CLAS-04, CLAS-05, CLAS-06
**Success Criteria** (what must be TRUE):
  1. Admin can create a student record (name, DOB, photo, medical notes, skill level) and link it to a family with one or more guardians
  2. Admin can search and filter students by name, class, and active status
  3. Admin can create a class with day, time, instructor, room, capacity, and age range, and view all classes on a visual weekly calendar
  4. Admin can enroll a student in a class; the system enforces the capacity limit and places them on the waitlist when full, then auto-promotes when a spot opens
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Router + Admin shell + SQL migrations (enrollment functions + storage bucket)
- [x] 02-02-PLAN.md — Family + student CRUD with photo upload, search/filter, RFID assignment
- [x] 02-03-PLAN.md — Class CRUD with weekly calendar and instructor picker
- [ ] 02-04-PLAN.md — Enrollment, waitlist, transfer + human verification checkpoint

**UI hint**: yes

### Phase 3: Billing
**Goal**: Admin can configure tuition plans, the system generates and charges invoices automatically via Stripe, and all payment states (active, past due, failed) are tracked and recoverable.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08
**Success Criteria** (what must be TRUE):
  1. Admin can create a tuition plan per class and the system generates invoices automatically based on enrollment
  2. Recurring Stripe charges run on the billing date without manual intervention
  3. Admin can apply sibling, scholarship, or staff discounts to a family and view the resulting invoice adjustment
  4. Admin can view a family's full payment history (paid, pending, overdue, waived) and manually record a cash or check payment
  5. Failed payments enter retry logic automatically; the system tracks past_due and unpaid states and does not process duplicate Stripe webhook events
**Plans**: TBD

### Phase 4: Communications and Parent Portal
**Goal**: Parents can log in to view their classes, pay invoices, and update contact info — and the system sends timely email and SMS notifications for absences, payments, and announcements without admin effort.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, COMM-06, COMM-07, COMM-08, PORT-01, PORT-02, PORT-03, PORT-04
**Success Criteria** (what must be TRUE):
  1. Parents can log in, view their enrolled students and class schedules, and update family contact information
  2. Parents can view outstanding invoices and pay them online via Stripe from the portal
  3. Parents receive an email when their child is enrolled, when a payment is received, and when their child is marked absent
  4. Parents receive an SMS absence alert and a payment reminder SMS when a payment is due or overdue
  5. Admin can send a broadcast email or SMS to all families or a filtered subset by class
**Plans**: TBD
**UI hint**: yes

### Phase 5: Admin Dashboard and Operations
**Goal**: Admin has a live operations dashboard, exportable reports, instructors can manage their own schedules and log hours, and recital events with costume tracking are fully managed in the system.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, STAF-01, STAF-02, STAF-03, EVNT-01, EVNT-02, EVNT-03
**Success Criteria** (what must be TRUE):
  1. Admin sees a dashboard with daily KPI cards (classes today, students checked in, absences, RFID check-ins) and today's class summary cards with attendance counts
  2. Admin can generate enrollment, revenue, and attendance rate reports and export any of them as CSV
  3. Instructors can view their assigned class schedules, mark attendance for their own classes, and log hours worked
  4. Admin can create a recital or event, enroll students, and track costume status per student (not ordered through returned)
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Attendance MVP | 3/4 | In Progress|  |
| 2. Studio Management | 3/4 | In Progress|  |
| 3. Billing | 0/TBD | Not started | - |
| 4. Communications and Parent Portal | 0/TBD | Not started | - |
| 5. Admin Dashboard and Operations | 0/TBD | Not started | - |
