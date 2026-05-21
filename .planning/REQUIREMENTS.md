# Requirements: LSODance Studio Platform

**Defined:** 2026-05-21
**Core Value:** Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad without asking for help.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: Staff can create an account with email and password via Supabase Auth
- [ ] **AUTH-02**: Staff can log in and session persists across browser refresh (iPad PWA)
- [ ] **AUTH-03**: Staff can reset password via email link
- [ ] **AUTH-04**: System enforces role-based access (admin, instructor, front_desk) via app_metadata
- [ ] **AUTH-05**: Admin can invite and assign roles to new staff members

### Attendance

- [ ] **ATTN-01**: Front desk sees today's classes with done/pending/in-progress status
- [ ] **ATTN-02**: Front desk can tap a class to open its roster
- [ ] **ATTN-03**: Front desk can mark each student present, absent, late, or excused with 56px+ tap targets
- [ ] **ATTN-04**: Front desk sees present/absent counts update in real time as they mark
- [ ] **ATTN-05**: Front desk can submit attendance with a confirmation modal showing counts
- [ ] **ATTN-06**: Submitted classes show checkmark and timestamp on the home screen
- [ ] **ATTN-07**: Attendance works offline via IndexedDB queue and syncs on reconnect (foreground sync)
- [ ] **ATTN-08**: System exposes POST /rfid/checkin endpoint that accepts card_uid and returns student name
- [ ] **ATTN-09**: Attendance records track marked_by source (manual or rfid)

### Students & Families

- [ ] **STUD-01**: Admin can create, edit, and deactivate student records (name, DOB, photo, medical notes, skill level)
- [ ] **STUD-02**: Admin can create and edit family records (guardians, email, phone, emergency contact)
- [ ] **STUD-03**: Students belong to a family; families can have multiple students
- [ ] **STUD-04**: Admin can assign RFID card UID to a student for future hardware integration
- [ ] **STUD-05**: Admin can search and filter students by name, class, active status

### Classes & Enrollment

- [ ] **CLAS-01**: Admin can create and edit classes (name, type, instructor, day/time, duration, room, capacity, age range, level)
- [ ] **CLAS-02**: Admin can view a visual weekly calendar of all classes
- [ ] **CLAS-03**: Admin can enroll students in classes
- [ ] **CLAS-04**: System enforces capacity limits and places students on waitlist when full
- [ ] **CLAS-05**: Admin can drop or transfer students between classes
- [ ] **CLAS-06**: System auto-promotes from waitlist when a spot opens

### Billing

- [ ] **BILL-01**: Admin can create tuition plans per class (monthly, per-session, or seasonal via Stripe)
- [ ] **BILL-02**: System generates invoices automatically based on enrollment and tuition plans
- [ ] **BILL-03**: System charges recurring payments via Stripe on the billing date
- [ ] **BILL-04**: Admin can apply sibling discounts, scholarship discounts, or staff discounts to families or classes
- [ ] **BILL-05**: Admin can view payment history by family (paid, pending, overdue, waived)
- [ ] **BILL-06**: Admin can manually record cash or check payments
- [ ] **BILL-07**: System handles failed payments with retry logic and status tracking (past_due, unpaid states)
- [ ] **BILL-08**: Stripe webhook handler is idempotent (guards against duplicate processing)

### Communications

- [ ] **COMM-01**: System sends enrollment confirmation emails via Resend
- [ ] **COMM-02**: System sends payment receipt emails via Resend
- [ ] **COMM-03**: System sends absence notification emails to parents via Resend
- [ ] **COMM-04**: System sends SMS absence alerts to parents via Twilio
- [ ] **COMM-05**: System sends SMS payment reminders via Twilio
- [ ] **COMM-06**: Admin can send broadcast email or SMS to all families or filtered by class
- [ ] **COMM-07**: System sends automated reminders for tuition due, missed payment, and upcoming events
- [ ] **COMM-08**: System logs all sent notifications with delivery status

### Parent Portal

- [ ] **PORT-01**: Parents can log in and view their enrolled students and classes
- [ ] **PORT-02**: Parents can view and pay outstanding invoices via Stripe
- [ ] **PORT-03**: Parents can update family contact information
- [ ] **PORT-04**: Parents can view attendance history for their students

### Admin Dashboard & Reports

- [ ] **DASH-01**: Admin sees daily KPI cards (classes today, students checked in, absences, RFID check-ins)
- [ ] **DASH-02**: Admin sees today's class summary cards with status and attendance counts
- [ ] **DASH-03**: Admin sees a recent attendance table with search and filter
- [ ] **DASH-04**: Admin can generate enrollment report by class
- [ ] **DASH-05**: Admin can generate revenue report by month
- [ ] **DASH-06**: Admin can generate attendance rate report by student
- [ ] **DASH-07**: Admin can export any report as CSV

### Staff Portal

- [ ] **STAF-01**: Instructors can view their assigned classes and schedules
- [ ] **STAF-02**: Instructors can mark attendance for their own classes
- [ ] **STAF-03**: Instructors can log hours worked

### Events & Recitals

- [ ] **EVNT-01**: Admin can create events (recital, showcase, workshop, camp) with date and venue
- [ ] **EVNT-02**: Admin can enroll students in events
- [ ] **EVNT-03**: Admin can track costumes per student per event (description, size, ordered, received, paid)

### Infrastructure

- [ ] **INFR-01**: All tables include organization_id for multi-tenant readiness
- [ ] **INFR-02**: Supabase RLS policies enforce tenant isolation on every table
- [ ] **INFR-03**: Database schema includes all entity types from domain model
- [ ] **INFR-04**: API uses Fastify with schema-based request/response validation
- [ ] **INFR-05**: Frontend is a Vite + React + TypeScript + Tailwind PWA with service worker

## v2 Requirements

### RFID Hardware

- **RFID-01**: Raspberry Pi with RC522/PN532 reader scans card UID and calls POST /rfid/checkin
- **RFID-02**: Pi displays student name and check-in confirmation on attached screen
- **RFID-03**: Pi provides LED/sound feedback on successful and failed scans
- **RFID-04**: Pi operates independently and queues check-ins when offline

### Advanced Features

- **ADVN-01**: Skill/progress tracking with instructor milestones per student
- **ADVN-02**: Makeup class scheduling for missed sessions
- **ADVN-03**: Multi-studio/multi-tenant organization switcher for licensing
- **ADVN-04**: Event ticketing and online registration

## Out of Scope

| Feature | Reason |
|---------|--------|
| QuickBooks integration | Not needed at this scale; Stripe handles financials |
| Enterprise multi-location hierarchy | Single studio first; multi-tenant schema supports future expansion |
| Video streaming / virtual classes | In-person studio only |
| Native mobile apps | PWA covers mobile needs |
| Real-time chat | Email/SMS communication sufficient |
| OAuth / social login | Email/password + Supabase Auth sufficient for v1 |
| Consumer marketplace / discovery | Established 22-year studio with community doesn't need discovery |
| 200+ report templates | 5-8 purposeful reports; competitors' report bloat is a negative in reviews |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| ATTN-01 | Phase 1 | Pending |
| ATTN-02 | Phase 1 | Pending |
| ATTN-03 | Phase 1 | Pending |
| ATTN-04 | Phase 1 | Pending |
| ATTN-05 | Phase 1 | Pending |
| ATTN-06 | Phase 1 | Pending |
| ATTN-07 | Phase 1 | Pending |
| ATTN-08 | Phase 1 | Pending |
| ATTN-09 | Phase 1 | Pending |
| STUD-01 | Phase 2 | Pending |
| STUD-02 | Phase 2 | Pending |
| STUD-03 | Phase 2 | Pending |
| STUD-04 | Phase 2 | Pending |
| STUD-05 | Phase 2 | Pending |
| CLAS-01 | Phase 2 | Pending |
| CLAS-02 | Phase 2 | Pending |
| CLAS-03 | Phase 2 | Pending |
| CLAS-04 | Phase 2 | Pending |
| CLAS-05 | Phase 2 | Pending |
| CLAS-06 | Phase 2 | Pending |
| BILL-01 | Phase 3 | Pending |
| BILL-02 | Phase 3 | Pending |
| BILL-03 | Phase 3 | Pending |
| BILL-04 | Phase 3 | Pending |
| BILL-05 | Phase 3 | Pending |
| BILL-06 | Phase 3 | Pending |
| BILL-07 | Phase 3 | Pending |
| BILL-08 | Phase 3 | Pending |
| COMM-01 | Phase 4 | Pending |
| COMM-02 | Phase 4 | Pending |
| COMM-03 | Phase 4 | Pending |
| COMM-04 | Phase 4 | Pending |
| COMM-05 | Phase 4 | Pending |
| COMM-06 | Phase 4 | Pending |
| COMM-07 | Phase 4 | Pending |
| COMM-08 | Phase 4 | Pending |
| PORT-01 | Phase 4 | Pending |
| PORT-02 | Phase 4 | Pending |
| PORT-03 | Phase 4 | Pending |
| PORT-04 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| DASH-07 | Phase 5 | Pending |
| STAF-01 | Phase 5 | Pending |
| STAF-02 | Phase 5 | Pending |
| STAF-03 | Phase 5 | Pending |
| EVNT-01 | Phase 5 | Pending |
| EVNT-02 | Phase 5 | Pending |
| EVNT-03 | Phase 5 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 1 | Pending |
| INFR-04 | Phase 1 | Pending |
| INFR-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 after initial definition*
