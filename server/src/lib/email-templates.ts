// ---------------------------------------------------------------------------
// Email templates -- plain HTML email templates for transactional notifications.
//
// Design: purple (#8F2DB5) header bar, DM Serif Display heading,
// Atkinson Hyperlegible body, studio branding.
//
// These are pure functions returning HTML strings. No React Email dependency.
// ---------------------------------------------------------------------------

const PURPLE = '#8F2DB5'
const INK_2 = '#555555'
const CREAM = '#FFF9F0'

/**
 * Shared email wrapper with studio branding header and footer.
 */
function emailWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:'Atkinson Hyperlegible',Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:16px;line-height:1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <!-- Purple header bar -->
          <tr>
            <td style="background:${PURPLE};padding:20px 28px;">
              <span style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;color:#ffffff;font-weight:400;">LSODance</span>
            </td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding:28px 28px 20px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px 24px 28px;border-top:1px solid #eee;">
              <p style="font-size:13px;color:${INK_2};margin:0;">
                LaShelle's School of Dance &bull; Oak Park, Michigan
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Enrollment confirmation
// ---------------------------------------------------------------------------

export function enrollmentConfirmation(
  studentName: string,
  className: string,
  studioName: string,
): string {
  const body = `
    <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:${PURPLE};margin:0 0 16px 0;font-weight:400;">
      Welcome to ${className}!
    </h1>
    <p style="margin:0 0 16px 0;">
      <strong>${studentName}</strong> has been enrolled in <strong>${className}</strong> at ${studioName}.
    </p>
    <p style="margin:0 0 16px 0;">
      We're excited to have them in class! If you have any questions about the schedule,
      what to bring, or the dress code, please don't hesitate to reach out.
    </p>
    <p style="margin:0;color:${INK_2};font-size:14px;">
      Thank you for choosing ${studioName}.
    </p>
  `
  return emailWrapper(`Welcome to ${className}!`, body)
}

// ---------------------------------------------------------------------------
// Payment receipt
// ---------------------------------------------------------------------------

export function paymentReceipt(
  familyName: string,
  amount: string,
  invoiceDate: string,
  paymentMethod: string,
): string {
  const body = `
    <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:${PURPLE};margin:0 0 16px 0;font-weight:400;">
      Payment Received
    </h1>
    <p style="margin:0 0 16px 0;">
      Hi ${familyName}, we've received your payment. Here are the details:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;font-size:15px;">
      <tr>
        <td style="padding:8px 0;color:${INK_2};border-bottom:1px solid #f0f0f0;">Amount</td>
        <td style="padding:8px 0;text-align:right;font-weight:700;border-bottom:1px solid #f0f0f0;">${amount}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:${INK_2};border-bottom:1px solid #f0f0f0;">Date</td>
        <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f0f0f0;">${invoiceDate}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:${INK_2};">Method</td>
        <td style="padding:8px 0;text-align:right;text-transform:capitalize;">${paymentMethod}</td>
      </tr>
    </table>
    <p style="margin:0;color:${INK_2};font-size:14px;">
      Thank you for your prompt payment!
    </p>
  `
  return emailWrapper('Payment Received', body)
}

// ---------------------------------------------------------------------------
// Absence alert
// ---------------------------------------------------------------------------

export function absenceAlert(
  studentName: string,
  className: string,
  date: string,
): string {
  const body = `
    <h1 style="font-family:'DM Serif Display',Georgia,serif;font-size:26px;color:${PURPLE};margin:0 0 16px 0;font-weight:400;">
      Absence Notice
    </h1>
    <p style="margin:0 0 16px 0;">
      <strong>${studentName}</strong> was marked absent from <strong>${className}</strong> on ${date}.
    </p>
    <p style="margin:0 0 16px 0;">
      If this absence was expected, no action is needed. If you believe this is an error,
      please contact the studio and we'll be happy to help.
    </p>
    <p style="margin:0;color:${INK_2};font-size:14px;">
      We look forward to seeing ${studentName} in the next class!
    </p>
  `
  return emailWrapper(`${studentName} - Absence Notice`, body)
}
