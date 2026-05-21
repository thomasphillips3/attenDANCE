<!-- generated-by: gsd-doc-writer -->
# LSODance Studio Platform

A full dance studio management platform built for LaShelle's School of Dance — a 22-year-old, family-owned Black dance studio in Oak Park, Michigan. Replacing Jackrabbit Class with a purpose-built system designed around the people who use it daily.

**Core value:** Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad, without asking for help.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Fastify 5 |
| Database | Supabase (Postgres + Auth + Realtime) |
| Frontend | Vite + React 19 + TypeScript + Tailwind v4 |
| Payments | Stripe |
| Email | Resend |
| SMS | Twilio |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

## Roadmap

Five phases that build from the front desk outward.

| Phase | Goal | Status |
|-------|------|--------|
| 1. Attendance MVP | Auth, multi-tenant schema, and the full Mrs. Goodman attendance flow — offline-first, iPad-ready | Not started |
| 2. Studio Management | Students, families, classes, enrollment, and waitlist — the data that feeds the roster | Not started |
| 3. Billing | Stripe recurring billing, invoices, payment tracking, and discounts | Not started |
| 4. Communications and Parent Portal | Transactional email, SMS, and the parent-facing portal | Not started |
| 5. Admin Dashboard and Operations | KPI dashboard, reports, staff portal, and event/recital management | Not started |

## Local Development

```bash
# Prerequisites
# - Node.js 20+
# - pnpm
# - Supabase CLI
# - Stripe CLI (for webhook testing)

# Setup
cp .env.example .env
pnpm install
pnpm dev
```

## Project Structure

```
/
├── apps/
│   ├── web/          # Admin + parent portal PWA
│   └── api/          # Fastify backend
├── packages/
│   └── shared/       # Shared types and utilities
├── supabase/
│   └── migrations/   # Postgres migrations
├── docs/             # Design mockups and documentation
└── .planning/        # Project planning artifacts
```

## Design Reference

Interactive design mockups live in the repo root (`design-canvas.jsx`, `app.jsx`, `admin.jsx`, `screens.jsx`, `spec.jsx`). Open `LSODance Attendance.html` in a browser to walk through the full Mrs. Goodman attendance flow, the admin dashboard, and the complete design system — palette, typography, components, and rationale.

These are visual reference only. The production app is a fresh build in Vite + React + TypeScript + Tailwind.

## Key Users

- **Mrs. Goodman** (front desk): Takes attendance on an iPad. Needs large tap targets (56px+), 18px+ body text, and minimal steps.
- **Carollette Williams** (studio director/owner): Admin dashboard, class management, billing oversight, communications.
- **Instructors**: View assigned classes, mark attendance, log hours.
- **Parents**: View enrolled classes, pay invoices, update family info, receive notifications.

## Planning

See `.planning/PROJECT.md` for requirements, context, and key decisions. See `.planning/ROADMAP.md` for phase details and success criteria.
