<!-- generated-by: gsd-doc-writer -->
# Billing Notes — LSODance Studio Platform

Reference for how Stripe maps to LSODance's tuition model. Read before touching any billing code. Contains policy decisions Carollette needs to make before implementation begins.

---

## 1. How Stripe Subscriptions Map to Tuition

The core model: **one Stripe Customer per family, one Stripe Subscription per family, one Subscription Item per enrolled class.**

```
Family (Stripe Customer)
  └── Subscription
        ├── Subscription Item → Ballet I tuition (Price: $85/month)
        ├── Subscription Item → Hip-Hop II tuition (Price: $80/month)
        └── Subscription Item → Jazz Technique tuition (Price: $75/month)
```

Stripe bundles all Subscription Items into a single monthly invoice. The parent sees one charge covering all their children's classes, not a separate charge per class.

### Data model alignment

Each `classes` row has a `tuition_plan_id` that references a `tuition_plans` table. Each tuition plan stores a `stripe_price_id` pointing to a recurring Stripe Price (`recurring.interval = month`).

```
classes.tuition_plan_id → tuition_plans.stripe_price_id → Stripe Price (monthly)
```

### Enrollment flow

When a student is enrolled in a class:

1. Look up the family's `stripe_customer_id` and `stripe_subscription_id`.
2. If the family has no Subscription yet, create one: `stripe.subscriptions.create({ customer: cus_xxx, items: [{ price: price_xxx }] })`.
3. If the family already has a Subscription, add a new item: `stripe.subscriptionItems.create({ subscription: sub_xxx, price: price_xxx })`.
4. Store the returned `stripe_subscription_item_id` on the enrollment record.

Do not create a new Subscription per student or per class. One Subscription per family, always.

---

## 2. Mid-Month Enrollments

**Stripe default behavior:** When a Subscription Item is added mid-cycle, Stripe calculates a prorated charge for the remaining days of the current billing period and generates an immediate invoice.

Example: Student enrolls on the 15th in a $80/month class. Billing day is the 1st. Stripe immediately charges ~$40 (half month) and then $80 on the 1st of next month.

### Policy decision required from Carollette

**Option A — Prorate (Stripe default):**
```typescript
stripe.subscriptionItems.create({
  subscription: sub_xxx,
  price: price_xxx,
  proration_behavior: 'create_prorations', // default
});
```
Parent is charged immediately for remaining days. Mathematically fair. Parents may be surprised by a charge mid-month.

**Option B — No proration, start next cycle:**
```typescript
stripe.subscriptionItems.create({
  subscription: sub_xxx,
  price: price_xxx,
  proration_behavior: 'none',
});
```
Parent is not charged until the next billing cycle. Simpler to explain. Studio absorbs the remaining days of the enrollment month for free.

**Recommendation:** Use `proration_behavior: 'none'` as the default. Dance studios commonly charge a full month starting from the next cycle. Unexpected mid-month charges generate support calls. Proration can always be enabled per-enrollment if Carollette prefers it case-by-case.

Whichever option is chosen, show the parent a billing preview before confirming enrollment using the Stripe Upcoming Invoices endpoint (`stripe.invoices.retrieveUpcoming`).

---

## 3. Dropping a Student

When a student is removed from a class, cancel the specific Subscription Item — not the entire Subscription. Other students in the family may still be enrolled.

```typescript
await stripe.subscriptionItems.del(si_xxx, {
  proration_behavior: 'create_prorations', // issues credit on next invoice
});
```

A credit appears on the family's next invoice for the unused portion of the dropped class's current billing period. If the credit should not be issued, use `proration_behavior: 'none'`.

### If the last item is removed

When `stripe.subscriptionItems.del` removes the last item on a Subscription, the Subscription becomes empty but remains active. Cancel it explicitly:

```typescript
const sub = await stripe.subscriptions.retrieve(sub_xxx);
if (sub.items.data.length === 0) {
  await stripe.subscriptions.cancel(sub_xxx);
  // clear stripe_subscription_id on the family record
}
```

Listen to `customer.subscription.deleted` webhook to keep the local `families.stripe_subscription_id` in sync in case the cancellation is triggered outside the application (e.g., from the Stripe Dashboard).

---

## 4. Refunds

Refunds go against a PaymentIntent, not an Invoice. Retrieve the PaymentIntent ID from the invoice before refunding.

```typescript
await stripe.refunds.create({
  payment_intent: pi_xxx,
  amount: 4000, // cents — partial refund of $40.00
});
```

Stripe allows refunds up to 180 days after the original charge. After 180 days, refunds must be processed as manual transfers outside Stripe.

### Local tracking

Record every refund in the `payments` table with a negative `amount` and a `type` of `refund`. Include the `stripe_refund_id` for reconciliation.

```sql
INSERT INTO payments (family_id, amount, type, stripe_refund_id, note)
VALUES ($1, -4000, 'refund', $2, 'Dropped from Ballet I — half-month credit');
```

Partial refunds are supported. A $80 invoice can be partially refunded for any amount up to $80.

---

## 5. Failed Payments and Dunning

### Stripe Subscription state machine

```
incomplete ──► active ──► past_due ──► unpaid ──► canceled
                              ▲             │
                              └─────────────┘ (payment succeeds during retry)
```

The application must handle all five states. Treating subscriptions as binary (active/canceled) is a documented pitfall — see PITFALLS.md Pitfall 7 — that results in parents being wrongly locked out or retaining access after non-payment.

| State | Portal Access | New Enrollments | Action |
|-------|--------------|-----------------|--------|
| `active` | Full | Allowed | None |
| `trialing` | Full | Allowed | None (only if trials are used) |
| `incomplete` | Full | Allowed | Show payment banner |
| `past_due` | Full | Blocked | Show prominent payment banner, send email + SMS |
| `unpaid` | Read-only | Blocked | Trigger dunning sequence, notify admin |
| `canceled` | Read-only history | Blocked | No active enrollments |

### Smart Retries

Enable Stripe Smart Retries in the Stripe Dashboard (Billing > Settings > Automatic retries). Configure to retry 3 times over 7 days before transitioning to `unpaid`.

Do not configure Stripe to auto-cancel subscriptions after `unpaid`. Dance studios frequently work out payment plans with families. Let admin decide on cancellation.

### Webhook handling for failed payments

On `invoice.payment_failed`:
1. Acknowledge the webhook with 200 immediately (see Section 8).
2. Look up the family by `stripe_customer_id`.
3. Send payment failure email via Resend.
4. Send SMS via Twilio to the primary guardian phone.
5. Log the event in `payment_events` table.

On `customer.subscription.updated` where `status` transitions to `unpaid`:
1. Set `families.subscription_status = 'unpaid'` in the local database.
2. Restrict parent portal access (block enrollment mutations, show read-only state).
3. Notify Carollette via email that this family needs attention.
4. Do not auto-cancel — flag for admin review.

---

## 6. Sibling and Scholarship Discounts

Discounts in Stripe use Coupons. The scope of application (Subscription vs. Subscription Item) determines whether a discount is family-level or student-level.

### Sibling discount (family-level)

Apply a Stripe Coupon to the Subscription. The discount applies to the entire invoice.

```typescript
await stripe.subscriptions.update(sub_xxx, {
  coupon: 'SIBLING10', // e.g., 10% off all items
});
```

Create sibling discount coupons once in the Stripe Dashboard or via the API with `percent_off`. Example: 10% off for second child, 15% off for third.

### Scholarship discount (student-level)

Apply a Stripe Coupon to the specific Subscription Item for that student's class.

```typescript
await stripe.subscriptionItems.update(si_xxx, {
  discounts: [{ coupon: 'SCHOLARSHIP50' }], // 50% off this item only
});
```

Subscription Item-level discounts require Stripe API version 2023-10-16 or later.

### Local tracking

Store all applied discounts in a `discounts` table for reporting without querying Stripe per report:

| Column | Type | Description |
|--------|------|-------------|
| `family_id` | uuid | References `families.id` |
| `student_id` | uuid, nullable | Null for family-level discounts |
| `stripe_coupon_id` | text | Stripe Coupon ID |
| `type` | text | `sibling`, `scholarship`, or `other` |
| `applied_at` | timestamptz | When the discount was applied |
| `applied_by` | uuid | Staff user who applied it |

---

## 7. Dance Studio-Specific Billing Patterns

Dance studio billing does not fit a pure subscription model. Several fee types are one-time charges that attach to invoices as Invoice Items, not Subscription Items.

### Summary of fee types

| Fee Type | Stripe Primitive | Recurring? |
|----------|-----------------|-----------|
| Monthly tuition per class | Subscription Item | Yes |
| Annual registration fee | Invoice Item | No (once per year) |
| Costume deposit | Invoice Item | No |
| Recital fee | Invoice Item | No |
| Late payment fee | Invoice Item | No (admin-added manually) |

### Registration fee (annual)

Charged once per student per year at enrollment. Add as an Invoice Item to attach to the family's next invoice.

```typescript
await stripe.invoiceItems.create({
  customer: cus_xxx,
  amount: 3500, // $35.00 in cents
  currency: 'usd',
  description: 'Annual registration fee — Amara Williams',
});
```

The Invoice Item attaches to the next open invoice automatically. To attach to a specific invoice, pass `invoice: inv_xxx`.

### Costume deposit

One-time Invoice Item created when the costume is ordered. Store the `stripe_invoice_item_id` on the costume record so the deposit can be refunded if the order is canceled.

```typescript
await stripe.invoiceItems.create({
  customer: cus_xxx,
  amount: 5000, // $50.00 in cents
  currency: 'usd',
  description: 'Costume deposit — Recital 2027 (Ballet I)',
  metadata: { costume_id: 'costume_xxx' },
});
```

### Recital fee

One-time Invoice Item per recital per student. Add when the student is registered for the recital.

### Seasonal billing (September–May)

If the season runs September through May with no classes in summer, use Stripe Subscription Schedules to automatically pause the subscription during June, July, and August.

```typescript
await stripe.subscriptionSchedules.create({
  from_subscription: sub_xxx,
  phases: [
    {
      items: [{ price: price_xxx }],
      start_date: 'now',
      end_date: /* June 1 Unix timestamp */,
    },
    {
      items: [], // pause — no items, no charges during summer
      start_date: /* June 1 Unix timestamp */,
      end_date: /* September 1 Unix timestamp */,
    },
    {
      items: [{ price: price_xxx }],
      start_date: /* September 1 Unix timestamp */,
    },
  ],
});
```

Subscription Schedules add implementation complexity. Confirm with Carollette whether summer pause is required for v1 or whether she handles it manually at season boundaries.

---

## 8. Webhook Handling

Stripe expects a 200 response within 5 seconds. All processing must happen asynchronously after acknowledgment. Processing synchronously is a documented pitfall — see PITFALLS.md Pitfall 6.

### Required pattern

```typescript
// Fastify route
fastify.post('/webhooks/stripe', async (request, reply) => {
  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return reply.status(400).send({ error: 'Invalid signature' });
  }

  // Idempotency check — unique constraint handles concurrent duplicates
  const existing = await db.query(
    'SELECT id FROM processed_webhook_events WHERE stripe_event_id = $1',
    [event.id],
  );
  if (existing.rows.length > 0) {
    return reply.status(200).send(); // already processed
  }

  // Persist event and return 200 before any async work
  await db.query(
    'INSERT INTO processed_webhook_events (stripe_event_id, event_type, payload) VALUES ($1, $2, $3)',
    [event.id, event.type, JSON.stringify(event)],
  );

  reply.status(200).send(); // acknowledge Stripe immediately

  // Process asynchronously — Stripe no longer waiting
  processWebhookEvent(event).catch((err) => {
    logger.error({ err, eventId: event.id }, 'Webhook processing failed');
  });
});
```

### `processed_webhook_events` table

```sql
CREATE TABLE processed_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,  -- UNIQUE enforces idempotency
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  processed_at    timestamptz DEFAULT now()
);
```

The `UNIQUE` constraint on `stripe_event_id` is the idempotency guard. A duplicate delivery causes the INSERT to fail, and the handler returns 200 without reprocessing.

### Key events to handle

| Event | Action |
|-------|--------|
| `invoice.paid` | Mark invoice paid in local `payments` table, send receipt email |
| `invoice.payment_failed` | Send email + SMS to parent, log in `payment_events` |
| `customer.subscription.updated` | Sync `status` to `families.subscription_status` |
| `customer.subscription.deleted` | Clear `stripe_subscription_id`, update access level |
| `invoice.upcoming` | (Optional) Send upcoming charge reminder 3 days before billing |

Do not poll Stripe for subscription state. Webhooks are the source of truth for status changes.

---

## Implementation Order

1. Confirm proration policy with Carollette (Section 2) — no code until this is decided.
2. Confirm seasonal billing requirements (Section 7) — Subscription Schedules add complexity.
3. Configure the Stripe Customer Portal to disable self-serve cancellation (see PITFALLS.md Pitfall 15).
4. Create Stripe Products and Prices for each class in the Stripe Dashboard.
5. Build the `processed_webhook_events` table and webhook handler first — everything else depends on idempotent event handling.
6. Build enrollment to Subscription Item creation flow.
7. Build the five-state access control layer before any parent-facing portal UI.
8. Add one-time Invoice Items for registration fees, costume deposits, recital fees.
9. Apply discount and coupon logic last — depends on the subscription model being stable.

---

*Last updated: 2026-05-21*
