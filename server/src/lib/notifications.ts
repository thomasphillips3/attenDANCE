import { Resend } from 'resend'
import Twilio from 'twilio'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Resend client -- lazily initialized from env var.
// Same pattern as Stripe in billing.ts: error only when actually used.
// ---------------------------------------------------------------------------
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error('RESEND_API_KEY env var is required for email notifications')
    }
    resendClient = new Resend(key)
  }
  return resendClient
}

// ---------------------------------------------------------------------------
// Twilio client -- lazily initialized from env vars.
// Error only when SMS is actually attempted, not at startup.
//
// NOTE: A2P 10DLC registration is required before production SMS works.
// Brand + campaign approval takes 1-2 weeks via Twilio console.
// Without 10DLC registration, messages to US numbers will be filtered/blocked.
// ---------------------------------------------------------------------------
let twilioClient: Twilio.Twilio | null = null
function getTwilio(): Twilio.Twilio {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars are required for SMS notifications',
      )
    }
    twilioClient = Twilio(sid, token)
  }
  return twilioClient
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SendEmailOpts {
  organizationId: string
  familyId?: string
  studentId?: string
  to: string
  subject: string
  html: string
  templateKey: string
  payload?: Record<string, unknown>
}

export interface SendSMSOpts {
  organizationId: string
  familyId?: string
  studentId?: string
  to: string
  body: string
  templateKey: string
  payload?: Record<string, unknown>
}

interface SendResult {
  success: boolean
  externalId?: string
  error?: string
}

// Keep backward compat alias
type SendEmailResult = SendResult

// ---------------------------------------------------------------------------
// sendEmail -- send an email via Resend and log to notification_log.
//
// Fire-and-forget usage: callers should NOT await this function in the
// request path. Wrap in a .catch() to prevent unhandled rejections.
//
// The from address uses RESEND_FROM_EMAIL env var, defaulting to a
// no-reply address on the Resend test domain.
// ---------------------------------------------------------------------------
export async function sendEmail(
  supabase: SupabaseClient,
  opts: SendEmailOpts,
  log: { info: Function; error: Function },
): Promise<SendEmailResult> {
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'LSODance <noreply@resend.dev>'

  // Insert a pending log entry first (audit trail even if send fails)
  const { data: logEntry, error: insertErr } = await supabase
    .from('notification_log')
    .insert({
      organization_id: opts.organizationId,
      family_id: opts.familyId ?? null,
      student_id: opts.studentId ?? null,
      type: 'email',
      recipient: opts.to,
      subject: opts.subject,
      template_key: opts.templateKey,
      payload: opts.payload ?? {},
      delivery_status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) {
    log.error({ error: insertErr }, 'Failed to insert notification_log entry')
    // Still try to send the email even if logging failed
  }

  const logId = logEntry?.id as string | undefined

  try {
    const resend = getResend()
    const result = await resend.emails.send({
      from: fromEmail,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    })

    // Resend returns { data: { id }, error: null } on success
    if (result.error) {
      throw new Error(result.error.message)
    }

    const externalId = result.data?.id ?? undefined

    // Update log entry to 'sent'
    if (logId) {
      await supabase
        .from('notification_log')
        .update({
          delivery_status: 'sent',
          external_id: externalId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logId)
    }

    log.info(
      { templateKey: opts.templateKey, to: opts.to, externalId },
      'Email sent successfully',
    )

    return { success: true, externalId }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    // Update log entry to 'failed'
    if (logId) {
      await supabase
        .from('notification_log')
        .update({
          delivery_status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', logId)
    }

    log.error(
      { error: errorMessage, templateKey: opts.templateKey, to: opts.to },
      'Failed to send email',
    )

    return { success: false, error: errorMessage }
  }
}

// ---------------------------------------------------------------------------
// sendSMS -- send an SMS via Twilio and log to notification_log.
//
// Fire-and-forget usage: callers should NOT await this function in the
// request path. Wrap in a .catch() to prevent unhandled rejections.
//
// The from number uses TWILIO_PHONE_NUMBER env var (E.164 format).
// ---------------------------------------------------------------------------
export async function sendSMS(
  supabase: SupabaseClient,
  opts: SendSMSOpts,
  log: { info: Function; error: Function },
): Promise<SendResult> {
  const fromPhone = process.env.TWILIO_PHONE_NUMBER
  if (!fromPhone) {
    const msg = 'TWILIO_PHONE_NUMBER env var is required for SMS notifications'
    log.error({}, msg)
    return { success: false, error: msg }
  }

  // Insert a pending log entry first (audit trail even if send fails)
  const { data: logEntry, error: insertErr } = await supabase
    .from('notification_log')
    .insert({
      organization_id: opts.organizationId,
      family_id: opts.familyId ?? null,
      student_id: opts.studentId ?? null,
      type: 'sms',
      recipient: opts.to,
      subject: null,
      template_key: opts.templateKey,
      payload: opts.payload ?? {},
      delivery_status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) {
    log.error({ error: insertErr }, 'Failed to insert notification_log entry for SMS')
    // Still try to send the SMS even if logging failed
  }

  const logId = logEntry?.id as string | undefined

  try {
    const twilio = getTwilio()
    const message = await twilio.messages.create({
      from: fromPhone,
      to: opts.to,
      body: opts.body,
    })

    const externalId = message.sid

    // Update log entry to 'sent'
    if (logId) {
      await supabase
        .from('notification_log')
        .update({
          delivery_status: 'sent',
          external_id: externalId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logId)
    }

    log.info(
      { templateKey: opts.templateKey, to: opts.to, externalId },
      'SMS sent successfully',
    )

    return { success: true, externalId }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    // Update log entry to 'failed'
    if (logId) {
      await supabase
        .from('notification_log')
        .update({
          delivery_status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', logId)
    }

    log.error(
      { error: errorMessage, templateKey: opts.templateKey, to: opts.to },
      'Failed to send SMS',
    )

    return { success: false, error: errorMessage }
  }
}
