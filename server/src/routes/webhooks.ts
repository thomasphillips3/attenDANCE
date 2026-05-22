import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendEmail } from '../lib/notifications.js'
import { paymentReceipt } from '../lib/email-templates.js'

// Stripe client — lazily initialized from env var.
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY env var is required for webhook routes')
    }
    stripeClient = new Stripe(key)
  }
  return stripeClient
}

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------

/**
 * invoice.payment_succeeded — Stripe confirms a subscription invoice was paid.
 * Find the matching local invoice by stripe_invoice_id, insert a payment record,
 * and flip the invoice status to 'paid'.
 */
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  supabase: SupabaseClient,
  log: { info: Function; warn: Function; error: Function },
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice
  const stripeInvoiceId = stripeInvoice.id
  const amountPaid = (stripeInvoice.amount_paid ?? 0) / 100 // cents -> dollars

  // Look up local invoice by stripe_invoice_id
  const { data: localInvoice, error: lookupErr } = await supabase
    .from('invoices')
    .select('id, organization_id, family_id, amount, status')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .maybeSingle()

  if (lookupErr) {
    log.error({ error: lookupErr, stripeInvoiceId }, 'Failed to look up local invoice')
    return
  }

  if (!localInvoice) {
    // Stripe-originated invoice not tracked locally yet — expected for first
    // subscription cycle before local invoice generation catches up.
    log.warn({ stripeInvoiceId }, 'No local invoice found for Stripe invoice — skipping')
    return
  }

  if (localInvoice.status === 'paid') {
    log.info({ stripeInvoiceId }, 'Invoice already marked paid — skipping')
    return
  }

  // Insert payment record
  const { error: payErr } = await supabase
    .from('payments')
    .insert({
      organization_id: localInvoice.organization_id,
      invoice_id: localInvoice.id,
      amount: amountPaid,
      method: 'stripe',
      paid_at: new Date().toISOString(),
      // Stripe SDK v22 removed payment_intent from the Invoice type, but the
      // webhook payload still includes it. Use the raw event object safely.
      stripe_payment_intent_id:
        (event.data.object as unknown as Record<string, unknown>).payment_intent as string ?? null,
      notes: `Stripe webhook: ${event.id}`,
    })

  if (payErr) {
    log.error({ error: payErr, stripeInvoiceId }, 'Failed to insert payment record from webhook')
    return
  }

  // Mark invoice as paid
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ status: 'paid' })
    .eq('id', localInvoice.id)

  if (updateErr) {
    log.error({ error: updateErr, invoiceId: localInvoice.id }, 'Failed to mark invoice as paid')
  }

  // Fire-and-forget: send payment receipt email (COMM-02)
  ;(async () => {
    try {
      if (!localInvoice.family_id) return

      const { data: family } = await supabase
        .from('families')
        .select('id, email, primary_guardian_name')
        .eq('id', localInvoice.family_id)
        .eq('organization_id', localInvoice.organization_id)
        .maybeSingle()

      if (!family?.email) return

      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amountPaid)

      const invoiceDate = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      await sendEmail(supabase, {
        organizationId: localInvoice.organization_id,
        familyId: family.id,
        to: family.email,
        subject: 'Payment Received',
        html: paymentReceipt(
          family.primary_guardian_name ?? 'Valued Family',
          formattedAmount,
          invoiceDate,
          'stripe',
        ),
        templateKey: 'payment_receipt',
        payload: {
          familyName: family.primary_guardian_name,
          amount: formattedAmount,
          invoiceDate,
          paymentMethod: 'stripe',
        },
      }, log)
    } catch (err) {
      log.error({ error: err }, 'Failed to send payment receipt email')
    }
  })()
}

/**
 * invoice.payment_failed — Stripe reports a failed charge attempt.
 * If next_payment_attempt is null, this is the final failure — mark overdue.
 * Otherwise Stripe will retry, so we just log it.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  supabase: SupabaseClient,
  log: { info: Function; warn: Function; error: Function },
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice
  const stripeInvoiceId = stripeInvoice.id
  const nextAttempt = stripeInvoice.next_payment_attempt

  const { data: localInvoice, error: lookupErr } = await supabase
    .from('invoices')
    .select('id, organization_id, status')
    .eq('stripe_invoice_id', stripeInvoiceId)
    .maybeSingle()

  if (lookupErr) {
    log.error({ error: lookupErr, stripeInvoiceId }, 'Failed to look up local invoice for failed payment')
    return
  }

  if (!localInvoice) {
    log.warn({ stripeInvoiceId }, 'No local invoice found for failed Stripe payment — skipping')
    return
  }

  if (nextAttempt === null) {
    // Final failure — all retry attempts exhausted
    log.warn({ stripeInvoiceId, invoiceId: localInvoice.id }, 'Final payment failure — marking invoice overdue')

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('id', localInvoice.id)

    if (updateErr) {
      log.error({ error: updateErr, invoiceId: localInvoice.id }, 'Failed to mark invoice as overdue')
    }
  } else {
    // Stripe will retry — log and keep current status
    log.info(
      { stripeInvoiceId, invoiceId: localInvoice.id, nextAttempt: new Date(nextAttempt * 1000).toISOString() },
      'Payment failed — Stripe will retry',
    )
  }
}

/**
 * payment_intent.succeeded — A one-off PaymentIntent (parent portal invoice
 * payment via Stripe Elements) was confirmed. Look up the local invoice from
 * the PaymentIntent metadata, insert a payment record, mark the invoice paid,
 * and send a receipt email.
 *
 * This is separate from invoice.payment_succeeded which handles Stripe
 * Invoice objects created by subscriptions.
 */
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  supabase: SupabaseClient,
  log: { info: Function; warn: Function; error: Function },
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const invoiceId = paymentIntent.metadata?.invoice_id
  const amountPaid = (paymentIntent.amount ?? 0) / 100 // cents -> dollars

  if (!invoiceId) {
    // PaymentIntent not linked to a local invoice (e.g. from Stripe Dashboard)
    log.info({ paymentIntentId: paymentIntent.id }, 'PaymentIntent has no invoice_id metadata — skipping')
    return
  }

  // Look up local invoice
  const { data: localInvoice, error: lookupErr } = await supabase
    .from('invoices')
    .select('id, organization_id, family_id, amount, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (lookupErr) {
    log.error({ error: lookupErr, invoiceId }, 'Failed to look up invoice for PaymentIntent')
    return
  }

  if (!localInvoice) {
    log.warn({ invoiceId, paymentIntentId: paymentIntent.id }, 'No local invoice found for PaymentIntent')
    return
  }

  if (localInvoice.status === 'paid') {
    log.info({ invoiceId }, 'Invoice already marked paid — skipping PaymentIntent handler')
    return
  }

  // Insert payment record
  const { error: payErr } = await supabase
    .from('payments')
    .insert({
      organization_id: localInvoice.organization_id,
      invoice_id: localInvoice.id,
      amount: amountPaid,
      method: 'stripe',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent.id,
      notes: `Stripe PaymentIntent: ${event.id}`,
    })

  if (payErr) {
    log.error({ error: payErr, invoiceId }, 'Failed to insert payment record from PaymentIntent')
    return
  }

  // Mark invoice as paid
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ status: 'paid' })
    .eq('id', localInvoice.id)

  if (updateErr) {
    log.error({ error: updateErr, invoiceId: localInvoice.id }, 'Failed to mark invoice as paid')
  }

  // Fire-and-forget: send payment receipt email
  ;(async () => {
    try {
      if (!localInvoice.family_id) return

      const { data: family } = await supabase
        .from('families')
        .select('id, email, primary_guardian_name')
        .eq('id', localInvoice.family_id)
        .eq('organization_id', localInvoice.organization_id)
        .maybeSingle()

      if (!family?.email) return

      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amountPaid)

      const invoiceDate = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      await sendEmail(supabase, {
        organizationId: localInvoice.organization_id,
        familyId: family.id,
        to: family.email,
        subject: 'Payment Received',
        html: paymentReceipt(
          family.primary_guardian_name ?? 'Valued Family',
          formattedAmount,
          invoiceDate,
          'stripe',
        ),
        templateKey: 'payment_receipt',
        payload: {
          familyName: family.primary_guardian_name,
          amount: formattedAmount,
          invoiceDate,
          paymentMethod: 'stripe',
        },
      }, log)
    } catch (err) {
      log.error({ error: err }, 'Failed to send payment receipt email from PaymentIntent')
    }
  })()
}

/**
 * customer.subscription.deleted — A subscription was cancelled (by admin or
 * Stripe due to repeated payment failures). Log for admin awareness but do NOT
 * auto-drop enrollments — that decision belongs to a human.
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  _supabase: SupabaseClient,
  log: { info: Function; warn: Function; error: Function },
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? 'unknown'

  log.warn(
    { subscriptionId: subscription.id, customerId, eventId: event.id },
    'Stripe subscription cancelled — admin should review enrollments',
  )
}

// ---------------------------------------------------------------------------
// Webhook route plugin
// ---------------------------------------------------------------------------

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Override the default JSON parser for this plugin scope only. Stripe
  // signature verification requires the raw request body (Buffer), but
  // Fastify's default parser deserializes JSON before the route handler
  // sees it. By registering a buffer parser here, only routes inside this
  // plugin receive the raw body — all other routes are unaffected.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body)
    },
  )

  // -----------------------------------------------------------------------
  // POST /webhooks/stripe — Stripe webhook receiver
  // -----------------------------------------------------------------------
  fastify.post('/webhooks/stripe', async (request, reply) => {
    const stripe = getStripe()
    const signature = request.headers['stripe-signature']

    if (!signature) {
      return reply.code(400).send({ error: 'Missing Stripe-Signature header' })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      fastify.log.error('STRIPE_WEBHOOK_SECRET env var is not set')
      return reply.code(500).send({ error: 'Webhook secret not configured' })
    }

    // Verify webhook signature — request.body is a Buffer from our custom parser
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        webhookSecret,
      )
    } catch (err) {
      fastify.log.warn({ error: err }, 'Stripe webhook signature verification failed')
      return reply.code(400).send({ error: 'Invalid webhook signature' })
    }

    // Idempotency check — prevent duplicate processing of the same event.
    // INSERT with ON CONFLICT DO NOTHING: if the row already exists the
    // insert returns no data, signalling we already processed this event.
    const { data: inserted, error: idempotencyErr } = await fastify.supabase
      .from('processed_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
      })
      .select('id')

    if (idempotencyErr) {
      // UNIQUE constraint violation means duplicate — return 200
      if (idempotencyErr.code === '23505') {
        fastify.log.info({ eventId: event.id }, 'Duplicate webhook event — already processed')
        return reply.code(200).send({ received: true, duplicate: true })
      }
      fastify.log.error({ error: idempotencyErr, eventId: event.id }, 'Failed idempotency check')
      // Still return 200 so Stripe doesn't retry on our DB errors
      return reply.code(200).send({ received: true })
    }

    if (!inserted || inserted.length === 0) {
      fastify.log.info({ eventId: event.id }, 'Duplicate webhook event — already processed')
      return reply.code(200).send({ received: true, duplicate: true })
    }

    // Route event to the appropriate handler
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event, fastify.supabase, fastify.log)
          break
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event, fastify.supabase, fastify.log)
          break
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event, fastify.supabase, fastify.log)
          break
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event, fastify.supabase, fastify.log)
          break
        default:
          fastify.log.info({ type: event.type }, 'Unhandled webhook event type')
      }
    } catch (handlerErr) {
      // Log the error but still return 200 — we don't want Stripe to retry
      // on our application errors. The event is already marked as processed.
      fastify.log.error(
        { error: handlerErr, eventId: event.id, type: event.type },
        'Webhook handler threw an error',
      )
    }

    return reply.code(200).send({ received: true })
  })
}

export default fp(webhooksRoutes, {
  name: 'webhooks',
  dependencies: ['supabase'],
})
