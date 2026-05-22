-- Migration: Add missing columns to notification_log for Resend integration
-- Plan 04-01: Notification Infrastructure + Email
--
-- The notification_log table was created in 000100 with basic columns.
-- This migration adds: template_key, payload, external_id, error_message
-- needed by the notification service for logging email sends via Resend.

-- template_key: identifies which email template was used (e.g. 'enrollment_confirmation')
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS template_key text;

-- payload: the full interpolation context passed to the template (jsonb)
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;

-- external_id: Resend message ID or Twilio SID for delivery tracking
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS external_id text;

-- error_message: captured error text when delivery_status = 'failed'
ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS error_message text;

-- Index on template_key for admin filtering
CREATE INDEX IF NOT EXISTS idx_notification_log_template_key
  ON notification_log (organization_id, template_key);

COMMENT ON COLUMN notification_log.template_key IS
  'Identifies the email/SMS template used (e.g. enrollment_confirmation, payment_receipt, absence_alert)';
COMMENT ON COLUMN notification_log.external_id IS
  'Provider message ID: Resend email ID or Twilio SID. Used for delivery webhook correlation.';
