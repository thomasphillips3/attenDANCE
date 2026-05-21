<!-- GSD:project-start source:PROJECT.md -->
## Project

**LSODance Studio Platform**

A full dance studio management platform replacing Jackrabbit Class for LaShelle's School of Dance (LSODance), a 22-year-old family-owned Black dance studio in Oak Park, Michigan. The platform covers attendance tracking, student/family management, class scheduling, enrollment, tuition billing, parent portal, communications, and recital management for 75-150 students. The existing design mockups (React/Babel) serve as visual reference; the production app is a fresh build in Vite + React + TypeScript + Tailwind.

**Core Value:** Mrs. Goodman at the front desk can take attendance for a full class in under 30 seconds on an iPad without asking for help.

### Constraints

- **Budget**: Free or near-free infrastructure. Supabase free tier, Vercel free tier, Railway starter. Stripe takes a cut but no monthly fee. Resend free tier. Twilio pay-as-you-go.
- **Tech stack**: Node.js + Fastify backend, Supabase (Postgres + Auth + Storage + Realtime), Vite + React + TypeScript + Tailwind frontend, Stripe for payments, Resend for email, Twilio for SMS, Vercel (frontend) + Railway (backend).
- **Accessibility**: Every screen Mrs. Goodman touches uses 18px+ body text, 56px+ tap targets, high contrast. Atkinson Hyperlegible font is non-negotiable for body text.
- **Multi-tenancy**: organization_id on every table from day one, even though we're building for one studio first.
- **Offline**: Attendance must work offline with IndexedDB queue and sync on reconnect.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Verdict
## Recommended Stack
### Core Framework — Backend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20 LTS (minimum) | Runtime | Fastify v5 targets Node 20+; Node 18 reached EOL April 2025 |
| Fastify | 5.8.5 | HTTP API server | 2-3x faster than Express (14K vs 6K req/s benchmarked), first-class TypeScript generics, schema-based validation baked in, 7.8M downloads/month, v5 stable GA |
| TypeScript | 5.x | Type safety | Fastify v5 ships updated type provider split (ValidatorSchema/SerializerSchema); json-schema-to-ts enables end-to-end type safety from route schema to handler |
| `@fastify/type-provider-typebox` | latest | Schema/type bridge | Recommended type provider for Fastify v5 TypeScript; TypeBox schemas serve double duty as JSON Schema validators and TS types |
### Core Framework — Frontend
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.2.6 | UI framework | Stable production release; `useActionState`, concurrent features, and improved Suspense matter for offline/sync UX patterns |
| Vite | 7.x | Build tool | Native ESM, sub-100ms HMR, first-class React+TS template; `vite-plugin-pwa` is the standard PWA integration path |
| TypeScript | 5.x | Type safety | Non-negotiable for a multi-developer project with a billing system |
| Tailwind CSS | 4.3.0 | Utility CSS | Production-ready as of January 2025; v4 replaces `tailwind.config.js` with CSS `@theme` directive — migration is not backward-compatible with v3 |
| `@tailwindcss/vite` | latest | Vite integration | v4-specific Vite plugin; no PostCSS config required, single `@import "tailwindcss"` in CSS |
### Database and Backend Services — Supabase
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Hosted (managed) | Postgres + Auth + Realtime + Storage | Postgres-native, open source, self-hostable, no vendor lock-in, RLS policies in SQL, Realtime via logical replication WebSockets |
| `@supabase/supabase-js` | 2.106.0 | JS client | v2 required; v2.79+ dropped Node 18 support (use Node 20+) |
| Row Level Security (RLS) | Postgres built-in | Multi-tenant data isolation | organization_id policies enforced at DB layer — every table with organization_id gets an RLS policy from day one |
### Payments
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node SDK) | 22.1.1 | Recurring billing, one-time payments | Best recurring billing API; no monthly platform fee; webhook-driven subscription lifecycle; excellent Node.js SDK |
| Stripe Billing | API version 2026-03-25.dahlia | Subscription management | v22 Node SDK maps to this API version |
- `customer.subscription.created` — provision access
- `customer.subscription.updated` — handle plan changes
- `customer.subscription.deleted` — revoke access
- `invoice.payment_succeeded` — record payment in local DB
- `invoice.payment_failed` — trigger reminder flow (Resend email + Twilio SMS)
- `customer.subscription.trial_will_end` — send 3-day warning
### Email
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | 6.12.3 | Transactional email | Developer-focused, React Email integration, 3K emails/month free permanently (capped at 100/day), setup in minutes |
| `react-email` | latest | Email templates | Compose emails as React components; Resend converts to HTML automatically; same component model as the frontend |
### SMS
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `twilio` | 6.0.2 | SMS notifications | Industry standard, best Node.js SDK, proven reliability, pay-as-you-go at low volume |
- ~400 messages/month × $0.0083 = ~$3.30 in messages
- Phone number: $1.15/month
- A2P 10DLC registration: one-time ~$14 (brand + campaign fee)
- Total monthly: ~$5-7/month
### Infrastructure and Deployment
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | N/A | Frontend hosting | Optimal for Vite/React SPAs; instant CDN deploys from git; free tier covers static/SPA hosting generously |
| Railway | Starter (usage-based) | Backend API hosting | Purpose-built for long-running Node.js services; better than Vercel serverless for persistent DB connections and WebSocket Realtime subscriptions |
| Service | Development | Production |
|---------|-------------|------------|
| Vercel (frontend) | $0 | $0 |
| Railway (backend API) | $0 (trial credit) | ~$5-15/month |
| Supabase | $0 (free tier, pauses) | $25/month (Pro) |
| Stripe | 2.9% + $0.30/transaction | same |
| Resend | $0 (3K/month) | $0 |
| Twilio | ~$5-7/month | ~$5-7/month |
| **Total** | **~$5-7** | **~$35-47/month** |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | v5 | Server state, caching, background sync | All API data fetching; replaces useEffect+fetch patterns; React 19 compatible; 12M weekly downloads |
| `dexie` | 4.x | IndexedDB wrapper | Offline attendance queue; standard IndexedDB abstraction for TypeScript; `useLiveQuery` React hook ships with v4 |
| `vite-plugin-pwa` | latest | Service worker, PWA manifest | Required for offline support, iPad home screen install, and background sync |
| `zustand` | 5.x | Client UI state | Lightweight state for UI-only state (selected class, modal visibility); avoids Context re-render problems |
| `zod` | 3.x | Schema validation | Frontend input validation; pairs with React Hook Form; define schema once, use on both form and API boundary |
| `react-hook-form` | 7.x | Form state management | Minimal re-renders; critical for enrollment and billing forms with many fields |
| `date-fns` | 4.x | Date manipulation | Timezone-safe date handling; essential for class scheduling across DST boundaries |
| `@radix-ui/react-*` | latest | Accessible UI primitives | Headless dialogs, dropdowns, selects styled with Tailwind; better accessibility than custom components; required for Mrs. Goodman's iPad UX |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | Fastify 5 | Express 4/5 | Express is maintenance-mode; no built-in schema validation; weaker TypeScript story |
| Backend framework | Fastify 5 | Hono | Hono is excellent but smaller plugin ecosystem; Fastify has official `@fastify/cors`, `@fastify/helmet`, `@fastify/multipart` needed here |
| Backend framework | Fastify 5 | tRPC + Next.js | tRPC requires Next.js as host; adds complexity for a separate frontend/backend split |
| Database | Supabase | Firebase | NoSQL wrong for relational studio data; proprietary RLS DSL; severe vendor lock-in |
| Database | Supabase | PlanetScale + custom auth | More infrastructure to manage; Supabase Auth + RLS is the right abstraction at this scale |
| CSS | Tailwind v4 | Tailwind v3 | v3 is in maintenance; v4 is the active branch |
| CSS | Tailwind v4 | CSS Modules | More verbose; utility-first system enforces design constraints across the team |
| Email | Resend | SendGrid | Free tier retired May 2025; worse DX; React Email integration is second-class |
| Email | Resend | Postmark | Excellent deliverability but no free tier; Resend wins at this volume |
| SMS | Twilio | Plivo | 35-40% cheaper but inferior SDK/docs; savings at this volume are under $2/month |
| Payments | Stripe | Square | Square optimized for in-person POS, not recurring SaaS billing |
| Payments | Stripe | PayPal | Inferior API and DX; not the SaaS standard |
| Frontend state | TanStack Query + Zustand | Redux Toolkit | RTK adds boilerplate; wrong abstraction for server state |
| Backend hosting | Railway | Vercel Functions | Serverless cold starts incompatible with WebSocket Realtime and persistent DB connection pools |
| Backend hosting | Railway | Fly.io | More complex to configure; Railway's git-push DX is simpler for a solo developer |
## Installation Reference
# Backend (Node.js + Fastify)
# Frontend (Vite + React + Tailwind v4)
## Decisions That Need Action Before Build Starts
## Sources
- [Fastify v5 official docs](https://fastify.dev/docs/latest/) — HIGH confidence
- [Fastify v5.8.5 release (GitHub)](https://github.com/fastify/fastify/releases) — HIGH confidence
- [Express vs Fastify benchmarks (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/) — MEDIUM confidence
- [Supabase JS v2 reference](https://supabase.com/docs/reference/javascript/introduction) — HIGH confidence
- [Supabase vs Firebase (Bytebase)](https://www.bytebase.com/blog/supabase-vs-firebase/) — MEDIUM confidence
- [Stripe Node v22.1.1 npm](https://www.npmjs.com/package/stripe) — HIGH confidence
- [Stripe v18 migration guide](https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v18) — HIGH confidence
- [Resend Node SDK (resend.com)](https://resend.com/nodejs) — HIGH confidence
- [Resend vs SendGrid (Nuntly)](https://nuntly.com/versus/resend-vs-sendgrid) — MEDIUM confidence
- [Twilio SMS Node.js quickstart](https://www.twilio.com/docs/messaging/quickstart) — HIGH confidence
- [Tailwind CSS v4.0 release](https://tailwindcss.com/blog/tailwindcss-v4) — HIGH confidence
- [React 19.2 release (react.dev)](https://react.dev/blog/2025/10/01/react-19-2) — HIGH confidence
- [TanStack Query v5 comparison](https://tanstack.com/query/v5/docs/framework/react/comparison) — HIGH confidence
- [Railway vs Vercel (Ritza)](https://ritza.co/articles/gen-articles/cloud-hosting-providers/railway-vs-vercel/) — MEDIUM confidence
- [Render vs Railway pricing (Encore)](https://encore.dev/articles/render-vs-railway) — MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
