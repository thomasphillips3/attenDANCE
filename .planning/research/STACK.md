# Technology Stack

**Project:** LSODance Studio Platform
**Researched:** 2026-05-21
**Research mode:** Validation — user-chosen stack verified against current best practices

---

## Verdict

The chosen stack is well-suited for this project. Every major choice is either the
current community standard or the best pragmatic option at this scale. Three specific
concerns are flagged below: Tailwind v4 config changes, the Stripe Node v22 billing
API changes, and Railway's no-free-tier policy affecting the cost constraint.

---

## Recommended Stack

### Core Framework — Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20 LTS (minimum) | Runtime | Fastify v5 targets Node 20+; Node 18 reached EOL April 2025 |
| Fastify | 5.8.5 | HTTP API server | 2-3x faster than Express (14K vs 6K req/s benchmarked), first-class TypeScript generics, schema-based validation baked in, 7.8M downloads/month, v5 stable GA |
| TypeScript | 5.x | Type safety | Fastify v5 ships updated type provider split (ValidatorSchema/SerializerSchema); json-schema-to-ts enables end-to-end type safety from route schema to handler |
| `@fastify/type-provider-typebox` | latest | Schema/type bridge | Recommended type provider for Fastify v5 TypeScript; TypeBox schemas serve double duty as JSON Schema validators and TS types |

**Fastify over Express:** Fastify is the correct choice for a greenfield 2025 project.
Express is effectively in maintenance mode. Fastify's schema-first approach catches
validation errors before they reach business logic — critical for a billing-adjacent API.
Performance at 75-150 students is irrelevant, but the DX advantages (types, schema, plugin
system) are not.

**Confidence: HIGH** — verified via Context7 (Fastify docs), official release notes (v5.8.5 confirmed), multiple benchmark sources.

---

### Core Framework — Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.2.6 | UI framework | Stable production release; `useActionState`, concurrent features, and improved Suspense matter for offline/sync UX patterns |
| Vite | 7.x | Build tool | Native ESM, sub-100ms HMR, first-class React+TS template; `vite-plugin-pwa` is the standard PWA integration path |
| TypeScript | 5.x | Type safety | Non-negotiable for a multi-developer project with a billing system |
| Tailwind CSS | 4.3.0 | Utility CSS | Production-ready as of January 2025; v4 replaces `tailwind.config.js` with CSS `@theme` directive — migration is not backward-compatible with v3 |
| `@tailwindcss/vite` | latest | Vite integration | v4-specific Vite plugin; no PostCSS config required, single `@import "tailwindcss"` in CSS |

**Tailwind v4 breaking change:** v4 eliminates `tailwind.config.js`. Since the mockup
uses inline styles (not Tailwind), this is a clean start. Design tokens go in a CSS file
under `@theme {}`. Browser floor: Safari 16.4+, Chrome 111+, Firefox 128+ — acceptable
for a studio management app targeting modern iPads.

**React 19 note:** Third-party libraries that depend on React internals may have issues.
Avoid Recoil. Use Zustand or React context for state. TanStack Query v5 is React 19
compatible.

**Confidence: HIGH** — verified via Context7 (Vite docs), official React blog, Tailwind
blog, npm version data.

---

### Database and Backend Services — Supabase

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Hosted (managed) | Postgres + Auth + Realtime + Storage | Postgres-native, open source, self-hostable, no vendor lock-in, RLS policies in SQL, Realtime via logical replication WebSockets |
| `@supabase/supabase-js` | 2.106.0 | JS client | v2 required; v2.79+ dropped Node 18 support (use Node 20+) |
| Row Level Security (RLS) | Postgres built-in | Multi-tenant data isolation | organization_id policies enforced at DB layer — every table with organization_id gets an RLS policy from day one |

**Supabase over Firebase:** The right call. Studio data is relational: students enroll in
classes, classes belong to sessions, invoices reference enrollments, attendance records
reference both students and classes. Firestore's document model would require
denormalization that creates consistency bugs at exactly the places where billing accuracy
matters. Supabase's lock-in story is also fundamentally better — a `pg_dump` migrates
the entire database to any Postgres host. Migrating off Firebase is a multi-month project.

**Free tier reality check:** Supabase free tier limits: 500MB database, 50MB file storage,
50K monthly active users, 2GB bandwidth. At 75-150 students, this is comfortable. Free
tier projects pause after 1 week of inactivity — use the free tier for development;
upgrade to Pro ($25/month) for production.

**Confidence: HIGH** — verified via Context7 (Supabase docs), official changelog, npm
version data.

---

### Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node SDK) | 22.1.1 | Recurring billing, one-time payments | Best recurring billing API; no monthly platform fee; webhook-driven subscription lifecycle; excellent Node.js SDK |
| Stripe Billing | API version 2026-03-25.dahlia | Subscription management | v22 Node SDK maps to this API version |

**Critical Stripe v22 changes affecting this project:**

1. `total_count` expansion on list endpoints is removed. Do not paginate using
   `expand: ['total_count']`; use cursor-based pagination (`starting_after`) instead.
2. Checkout Sessions for subscriptions now postpone subscription creation until after
   payment completes — this is better behavior for a studio platform (prevents
   subscriptions for failed first payments).

**Webhook events to handle for studio billing:**
- `customer.subscription.created` — provision access
- `customer.subscription.updated` — handle plan changes
- `customer.subscription.deleted` — revoke access
- `invoice.payment_succeeded` — record payment in local DB
- `invoice.payment_failed` — trigger reminder flow (Resend email + Twilio SMS)
- `customer.subscription.trial_will_end` — send 3-day warning

**Confidence: HIGH** — verified via Context7 (stripe-node docs, migration guide v18), npm
version data (v22.1.1 confirmed).

---

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | 6.12.3 | Transactional email | Developer-focused, React Email integration, 3K emails/month free permanently (capped at 100/day), setup in minutes |
| `react-email` | latest | Email templates | Compose emails as React components; Resend converts to HTML automatically; same component model as the frontend |

**Resend over SendGrid:** Correct for this project. SendGrid retired its free tier on
May 27, 2025. Resend's free tier (3K/month, 100/day) covers a studio sending enrollment
confirmations, payment receipts, and absence notifications to 150 families with room
to spare. The React Email DX is genuinely superior — templates are typed React components
instead of HTML strings or proprietary DSLs.

**Deliverability note:** Resend shares IP infrastructure with other senders. For a small
studio sending transactional-only email to opt-in families, this is not a concern.

**Confidence: HIGH** — verified via npm version data (resend@6.12.3), official Resend docs,
multiple comparison sources.

---

### SMS

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `twilio` | 6.0.2 | SMS notifications | Industry standard, best Node.js SDK, proven reliability, pay-as-you-go at low volume |

**Twilio cost reality at 150 students:**

Assuming 2-3 SMS per student per month (absence alerts, payment reminders,
announcements):
- ~400 messages/month × $0.0083 = ~$3.30 in messages
- Phone number: $1.15/month
- A2P 10DLC registration: one-time ~$14 (brand + campaign fee)
- Total monthly: ~$5-7/month

This is well within budget. **A2P 10DLC registration is mandatory** for business SMS in
the US. Twilio throttles or blocks unregistered traffic. Budget 1-2 weeks for carrier
approval before sending any messages.

**Plivo considered:** Plivo is 35-40% cheaper per message but has inferior documentation
and SDK quality. At this volume the savings are under $2/month — not worth the DX
tradeoff.

**Confidence: HIGH** — verified via npm version data (twilio@6.0.2), official Twilio docs,
cost estimates from Twilio pricing.

---

### Infrastructure and Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | N/A | Frontend hosting | Optimal for Vite/React SPAs; instant CDN deploys from git; free tier covers static/SPA hosting generously |
| Railway | Starter (usage-based) | Backend API hosting | Purpose-built for long-running Node.js services; better than Vercel serverless for persistent DB connections and WebSocket Realtime subscriptions |

**Critical constraint flag — Railway free tier removed:**

Railway eliminated its free tier in 2024. A Node.js API on Railway runs approximately
$5-15/month (usage-based on RAM and CPU). The PROJECT.md lists Railway as a
"free or near-free" option — this needs a budget update. Railway offers $5 in trial credit
(no card required) to start.

**Actual cost estimate for this stack at launch:**

| Service | Development | Production |
|---------|-------------|------------|
| Vercel (frontend) | $0 | $0 |
| Railway (backend API) | $0 (trial credit) | ~$5-15/month |
| Supabase | $0 (free tier, pauses) | $25/month (Pro) |
| Stripe | 2.9% + $0.30/transaction | same |
| Resend | $0 (3K/month) | $0 |
| Twilio | ~$5-7/month | ~$5-7/month |
| **Total** | **~$5-7** | **~$35-47/month** |

**Render as Railway alternative:** Render's $7/month Starter plan per service is always-on
(no cold starts) with predictable flat-rate billing. If Railway's consumption-based billing
feels unpredictable for a studio owner watching costs, Render is a valid alternative with
near-identical DX.

**Confidence: HIGH (Vercel), MEDIUM (Railway cost estimate)** — verified via deployment
platform comparison sources, official Railway and Render pricing pages.

---

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

**On TanStack Query for offline:** Use it from day one for all Supabase and Stripe data.
The offline/background sync patterns (`staleTime`, `gcTime`, `refetchOnReconnect`) align
directly with the attendance offline requirement. Combine TanStack Query's
`refetchOnReconnect` with Dexie's offline queue: queue writes to IndexedDB when offline,
drain the queue via a mutation on reconnect.

**On Dexie.js:** The attendance offline requirement (IndexedDB queue, sync on reconnect)
is a standard Dexie pattern. Dexie v4 has `useLiveQuery` React hooks that integrate with
React 19. The RFID endpoint (`POST /rfid/checkin`) follows the same queue/sync pattern.

**Confidence: HIGH (all libraries)** — verified via Context7 (Dexie.js docs), community
adoption data, React 19 compatibility research.

---

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

---

## Installation Reference

```bash
# Backend (Node.js + Fastify)
npm install fastify @fastify/cors @fastify/helmet @fastify/multipart @fastify/type-provider-typebox
npm install @supabase/supabase-js stripe resend twilio
npm install -D typescript @types/node

# Frontend (Vite + React + Tailwind v4)
npm create vite@latest client -- --template react-ts
cd client
npm install tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js
npm install @tanstack/react-query zustand
npm install react-hook-form zod @hookform/resolvers
npm install dexie dexie-react-hooks
npm install date-fns
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
npm install -D vite-plugin-pwa
```

---

## Decisions That Need Action Before Build Starts

1. **Railway pricing acknowledgement:** Confirm ~$10-15/month backend cost is acceptable.
   Consider Render ($7/month flat) as an alternative for predictable billing.

2. **Supabase production tier:** Plan for $25/month Pro upgrade before studio goes live.
   Free tier pauses after 1 week of inactivity — not acceptable in production.

3. **Twilio A2P 10DLC registration:** Register brand and campaign before any SMS sends.
   Allow 1-2 weeks for carrier approval. Without it, messages are throttled or blocked.

4. **Tailwind v4 CSS-first config:** All design tokens (deep purple `#8F2DB5`, champagne
   gold, DM Serif Display, Atkinson Hyperlegible) go in a CSS `@theme {}` block from day
   one. No `tailwind.config.js` — that pattern is v3 only.

5. **Stripe v22 pagination:** Do not use `expand: ['total_count']` on any list endpoint.
   Use `starting_after` cursor-based pagination.

---

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
