import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useParentInvoices, usePayInvoice } from '../../hooks/useParent'
import PaymentForm from '../../components/parent/PaymentForm'

/**
 * ParentInvoices -- invoice list + Stripe Elements payment for parent portal.
 *
 * Shows all invoices for the parent's family with status badges.
 * Unpaid invoices (pending/overdue) have a "Pay Now" button that creates
 * a PaymentIntent and opens the embedded Stripe Elements form.
 *
 * Design: mobile-first, 18px+ body, 56px+ tap targets, studio branding.
 */

// Stripe publishable key -- loaded once, reused across payments
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
)

interface PaymentState {
  invoiceId: string
  clientSecret: string
  amount: number
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'var(--color-gold-soft, #fff8e1)', color: 'var(--color-gold, #f9a825)', label: 'Pending' },
  paid: { bg: 'var(--color-green-soft, #e8f5e9)', color: 'var(--color-green, #2e7d32)', label: 'Paid' },
  overdue: { bg: 'var(--color-red-soft, #fce4ec)', color: 'var(--color-red, #c62828)', label: 'Overdue' },
  waived: { bg: 'var(--color-paper, #f5f5f5)', color: 'var(--color-ink-3, #999)', label: 'Waived' },
}

export default function ParentInvoices() {
  const { data, isLoading, error, refetch } = useParentInvoices()
  const payMutation = usePayInvoice()
  const [paymentState, setPaymentState] = useState<PaymentState | null>(null)

  async function handlePayNow(invoiceId: string) {
    try {
      const result = await payMutation.mutateAsync(invoiceId)
      setPaymentState({
        invoiceId,
        clientSecret: result.clientSecret,
        amount: result.amount,
      })
    } catch {
      // Error is handled by the mutation state
    }
  }

  function handlePaymentSuccess() {
    setPaymentState(null)
    refetch()
  }

  function handlePaymentCancel() {
    setPaymentState(null)
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <span
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--color-purple-tint-strong)',
            borderTopColor: 'var(--color-purple)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          background: 'var(--color-red-soft)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-red)',
          fontSize: 18,
        }}
      >
        Failed to load invoices. Please try again.
      </div>
    )
  }

  const invoices = data?.invoices ?? []

  // If payment form is open, show it instead of the list
  if (paymentState) {
    return (
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 400,
            color: 'var(--color-ink)',
            marginBottom: 24,
          }}
        >
          Invoices
        </h1>
        <div
          style={{
            background: 'var(--color-white)',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <PaymentForm
            stripePromise={stripePromise}
            clientSecret={paymentState.clientSecret}
            amount={paymentState.amount}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 24,
        }}
      >
        Invoices
      </h1>

      {payMutation.error && (
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
          Failed to start payment. Please try again.
        </div>
      )}

      {invoices.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: 'var(--color-white)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>
            No invoices found.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {invoices.map((invoice) => {
            const statusInfo = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.pending
            const canPay = invoice.status === 'pending' || invoice.status === 'overdue'
            const formattedAmount = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(Number(invoice.amount))
            const formattedDate = invoice.due_date
              ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''

            return (
              <div
                key={invoice.id}
                style={{
                  background: 'var(--color-white)',
                  borderRadius: 'var(--radius-md)',
                  padding: 20,
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Top row: amount + status badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {formattedAmount}
                  </span>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      fontSize: 14,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Due date */}
                <div style={{ fontSize: 16, color: 'var(--color-ink-2)' }}>
                  {invoice.status === 'paid' ? 'Paid' : 'Due'}: {formattedDate}
                </div>

                {/* Pay button for unpaid invoices */}
                {canPay && (
                  <button
                    onClick={() => handlePayNow(invoice.id)}
                    disabled={payMutation.isPending}
                    style={{
                      minHeight: 56,
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: payMutation.isPending
                        ? 'var(--color-ink-3)'
                        : 'var(--color-purple)',
                      color: 'var(--color-white)',
                      fontSize: 18,
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      cursor: payMutation.isPending ? 'not-allowed' : 'pointer',
                      width: '100%',
                    }}
                  >
                    {payMutation.isPending ? 'Setting up payment...' : 'Pay Now'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
