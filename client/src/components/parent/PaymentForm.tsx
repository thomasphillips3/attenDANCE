import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { Stripe as StripeType } from '@stripe/stripe-js'

/**
 * PaymentForm -- Stripe Elements embedded payment form for parent invoice payments.
 *
 * Receives the Stripe instance + clientSecret from the parent component.
 * Uses PaymentElement (supports cards + wallets via automatic_payment_methods).
 *
 * Design: mobile-first, 18px+ body text, 56px+ tap targets, studio purple branding.
 */

interface PaymentFormInnerProps {
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

function PaymentFormInner({ amount, onSuccess, onCancel }: PaymentFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!stripe || !elements) return

    setSubmitting(true)
    setErrorMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/parent/invoices',
      },
      redirect: 'if_required',
    })

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    } else {
      // Payment succeeded (no redirect needed)
      setSucceeded(true)
      setSubmitting(false)
      // Brief delay so user sees the success message before list refreshes
      setTimeout(onSuccess, 1500)
    }
  }

  if (succeeded) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-green-soft, #e8f5e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 32,
          }}
        >
          &#10003;
        </div>
        <h3
          style={{
            fontSize: 22,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            color: 'var(--color-ink)',
            marginBottom: 8,
          }}
        >
          Payment Successful
        </h3>
        <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>
          {formattedAmount} has been paid. A receipt will be emailed to you.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3
        style={{
          fontSize: 22,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 4,
        }}
      >
        Pay Invoice
      </h3>
      <p style={{ fontSize: 18, color: 'var(--color-ink-2)', marginBottom: 24 }}>
        Amount: <strong>{formattedAmount}</strong>
      </p>

      <div style={{ marginBottom: 24 }}>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--color-red-soft, #fce4ec)',
            color: 'var(--color-red, #c62828)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 16,
            marginBottom: 16,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            flex: 1,
            minHeight: 56,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-line)',
            background: 'var(--color-white)',
            color: 'var(--color-ink-2)',
            fontSize: 18,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !stripe || !elements}
          style={{
            flex: 2,
            minHeight: 56,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: submitting ? 'var(--color-ink-3)' : 'var(--color-purple)',
            color: 'var(--color-white)',
            fontSize: 18,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Processing...' : `Pay ${formattedAmount}`}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Outer wrapper -- provides Stripe Elements context
// ---------------------------------------------------------------------------

interface PaymentFormProps {
  stripePromise: Promise<StripeType | null>
  clientSecret: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

export default function PaymentForm({
  stripePromise,
  clientSecret,
  amount,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#8F2DB5',
            fontFamily: '"Atkinson Hyperlegible", system-ui, sans-serif',
            fontSizeBase: '18px',
            borderRadius: '8px',
            spacingUnit: '5px',
          },
        },
      }}
    >
      <PaymentFormInner amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  )
}
