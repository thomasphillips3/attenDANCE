# LSODance Studio Platform

## What This Is

A full dance studio management platform replacing Jackrabbit Class for LaShelle's School of Dance (LSODance), a 22-year-old family-owned Black dance studio in Oak Park, Michigan. The platform covers attendance tracking, student/family management, class scheduling, enrollment, tuition billing, parent portal, communications, and recital management for 75-150 students. The existing design mockups (React/Babel) serve as visual reference; the production app is a fresh build in Vite + React + TypeScript + Tailwind.

## Core Value

Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad without asking for help.

## Requirements

### Validated

(None yet -- ship to validate)

### Active

- [ ] Staff authentication via Supabase Auth with role-based access (admin, instructor, front desk)
- [ ] Class selection screen showing today's classes with status
- [ ] Roster-based attendance marking (present/absent/late/excused) with large tap targets
- [ ] Offline-first attendance with IndexedDB queue and sync
- [ ] RFID check-in endpoint ready from day one (POST /rfid/checkin)
- [ ] Student and family CRUD with enrollment management
- [ ] Class scheduling with visual weekly calendar
- [ ] Recurring tuition billing via Stripe
- [ ] Parent portal for viewing classes, paying invoices, updating family info
- [ ] Email notifications via Resend (enrollment, payment, absence)
- [ ] SMS notifications via Twilio (absence alerts, payment reminders, announcements)
- [ ] Recital and event management with costume tracking
- [ ] Admin dashboard with attendance summaries, KPIs, and reporting
- [ ] Multi-tenant data model (organization_id on every table) for future licensing

### Out of Scope

- QuickBooks integration -- not needed at this scale, Stripe handles financials
- Enterprise features (multi-location hierarchy, franchise management) -- single studio first
- Video streaming or virtual classes -- in-person studio only
- Native mobile apps -- PWA covers mobile needs
- Real-time chat -- email/SMS communication sufficient
- OAuth/social login -- email/password + Supabase Auth sufficient for v1

## Context

**Studio background:** LaShelle's School of Dance has performed at the Detroit Opera House and in the Thanksgiving Day Parade for 22 years. The brand carries prestige -- the design reflects this with deep purple (#8F2DB5), champagne gold accents, DM Serif Display headlines, and Atkinson Hyperlegible body text (designed by the Braille Institute for maximum readability).

**Current pain:** Jackrabbit Class costs $75-120/month and is too complex. Too many clicks for simple tasks. Mrs. Goodman (elderly, basic tech comfort) takes attendance at the front desk on an iPad and needs a simpler experience.

**Design artifacts:** The repo contains a complete interactive design mockup (React/Babel/browser-compiled JSX) with:
- iPad PWA screens: class selection, roster, confirm, success, offline banner
- Interactive end-to-end flow (tap through the full Mrs. Goodman journey)
- Admin dashboard (Carollette's desktop view)
- Full design system: palette, typography, components, rationale
These are visual reference only -- the production app is a fresh build.

**Key users:**
- **Mrs. Goodman** (front desk): Takes attendance on iPad. Needs large tap targets, readable text, minimal steps.
- **Carollette Williams** (studio director/owner): Admin dashboard, class management, billing oversight, communications.
- **Instructors**: View assigned classes, mark attendance, log hours.
- **Parents**: View enrolled classes, pay invoices, update family info, receive notifications.

**RFID pilot:** A Raspberry Pi with RC522/PN532 card reader will eventually handle automated check-in. The attendance system supports both manual (iPad) and RFID check-in from day one.

## Constraints

- **Budget**: Free or near-free infrastructure. Supabase free tier, Vercel free tier, Railway starter. Stripe takes a cut but no monthly fee. Resend free tier. Twilio pay-as-you-go.
- **Tech stack**: Node.js + Fastify backend, Supabase (Postgres + Auth + Storage + Realtime), Vite + React + TypeScript + Tailwind frontend, Stripe for payments, Resend for email, Twilio for SMS, Vercel (frontend) + Railway (backend).
- **Accessibility**: Every screen Mrs. Goodman touches uses 18px+ body text, 56px+ tap targets, high contrast. Atkinson Hyperlegible font is non-negotiable for body text.
- **Multi-tenancy**: organization_id on every table from day one, even though we're building for one studio first.
- **Offline**: Attendance must work offline with IndexedDB queue and sync on reconnect.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fresh build over mockup port | Design mockups are browser-compiled JSX with inline styles. Production needs Vite + TS + Tailwind for maintainability, type safety, and performance. Mockups serve as pixel-perfect visual reference. | -- Pending |
| Real auth in Phase 1 | Mrs. Goodman needs to log in. Stubbing auth delays a core workflow and creates tech debt. Supabase Auth is fast to set up. | -- Pending |
| Supabase over Firebase | Postgres-based, open source, generous free tier, built-in Auth + Realtime + Storage. Better fit for relational studio data than Firestore's document model. | -- Pending |
| Fastify over Express | Faster, schema-based validation, better TypeScript support, lower overhead. | -- Pending |
| Stripe over Square/PayPal | Best recurring billing API, no monthly fee, excellent docs, Supabase-friendly. | -- Pending |
| Multi-tenant schema from day one | Adding organization_id later requires painful migration. Cost of including it now is near-zero. | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-21 after initialization*
