import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFamily } from '../../hooks/useFamilies'
import { useInvoices, useUpdateInvoice } from '../../hooks/useInvoices'
import { usePayments } from '../../hooks/usePayments'
import { useDiscounts } from '../../hooks/useDiscounts'
import type { Invoice } from '../../hooks/useInvoices'
import type { Payment } from '../../hooks/usePayments'
import RecordPaymentModal from '../../components/admin/RecordPaymentModal'
import GenerateInvoiceModal from '../../components/admin/GenerateInvoiceModal'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'

const STATUS_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  pending: { background: '#fef9c3', color: '#854d0e' },
  paid: { background: '#dcfce7', color: '#166534' },
  overdue: { background: '#fef2f2', color: '#dc2626' },
  waived: { background: '#f3f4f6', color: '#6b7280' },
}

/**
 * Format a currency amount as USD.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Format an ISO date string for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format a timestamp for payment history display.
 */
function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * FamilyBilling -- admin page showing a single family's complete billing overview.
 *
 * Shows:
 * - Family name + Stripe connection status
 * - Summary cards: Total Owed, Total Paid, Active Discounts
 * - Invoice history table with status badges and actions
 * - Payment history table sorted by date DESC
 * - Action buttons: Generate Invoice, Record Payment
 *
 * Default export for React.lazy compatibility.
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function FamilyBilling() {
  const { id: familyId } = useParams<{ id: string }>()
  const { data: family, isLoading: familyLoading } = useFamily(familyId)
  const { data: invoicesResponse, isLoading: invoicesLoading } = useInvoices({
    familyId,
  })
  const { data: paymentsResponse, isLoading: paymentsLoading } = usePayments({
    familyId,
  })
  const { data: discounts } = useDiscounts({ familyId })
  const updateInvoice = useUpdateInvoice()

  const invoices = invoicesResponse?.data ?? []
  const payments = paymentsResponse?.data ?? []

  // Active discounts for this family
  const activeDiscounts = (discounts ?? []).filter((d) => d.active)

  // Summary calculations
  const totalOwed = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0)

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<{
    invoiceId: string
    invoiceAmount: number
  } | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<{
    id: string
    amount: number
  } | null>(null)
  const [isWaiving, setIsWaiving] = useState(false)

  const handleWaive = async () => {
    if (!waiveTarget) return
    setIsWaiving(true)
    try {
      await updateInvoice.mutateAsync({ id: waiveTarget.id, status: 'waived' })
      setWaiveTarget(null)
    } catch {
      // Error handled by mutation
    } finally {
      setIsWaiving(false)
    }
  }

  const isLoading = familyLoading || invoicesLoading || paymentsLoading

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Back link */}
      <Link
        to="/admin/families"
        style={{
          fontSize: 14,
          color: 'var(--color-purple)',
          textDecoration: 'none',
          fontFamily: 'var(--font-body)',
        }}
      >
        &larr; Back to Families
      </Link>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              color: 'var(--color-ink)',
              margin: '0 0 4px 0',
            }}
          >
            {family?.primary_guardian_name ?? 'Loading...'} -- Billing
          </h1>
          {/* Stripe status badge */}
          <span
            style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              background: family?.stripe_customer_id
                ? '#dcfce7'
                : '#f3f4f6',
              color: family?.stripe_customer_id
                ? '#166534'
                : '#6b7280',
            }}
          >
            {family?.stripe_customer_id ? 'Stripe Connected' : 'No Stripe'}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 56,
              padding: '0 24px',
              background: 'var(--color-purple)',
              color: 'var(--color-white)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Generate Invoice
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
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
      )}

      {!isLoading && (
        <>
          {/* ============================================================= */}
          {/* SUMMARY CARDS                                                  */}
          {/* ============================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}
          >
            {/* Total Owed */}
            <div
              style={{
                background: 'var(--color-white)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: totalOwed > 0 ? '#dc2626' : 'var(--color-ink)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {formatCurrency(totalOwed)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  marginTop: 2,
                }}
              >
                Total Owed
              </div>
            </div>

            {/* Total Paid */}
            <div
              style={{
                background: 'var(--color-white)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#166534',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {formatCurrency(totalPaid)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  marginTop: 2,
                }}
              >
                Total Paid
              </div>
            </div>

            {/* Active Discounts */}
            <div
              style={{
                background: 'var(--color-white)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--color-purple)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {activeDiscounts.length}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  marginTop: 2,
                }}
              >
                Active Discounts
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* INVOICE HISTORY                                                */}
          {/* ============================================================= */}
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
              }}
            >
              Invoice History
            </h2>

            {invoices.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 32,
                  fontSize: 18,
                  color: 'var(--color-ink-3)',
                  fontStyle: 'italic',
                }}
              >
                No invoices yet
              </div>
            )}

            {invoices.length > 0 && (
              <div
                style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 16,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--color-line)',
                        background: 'var(--color-cream)',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Date
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Amount
                      </th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Status
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Due Date
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice: Invoice) => {
                      const badgeStyle = STATUS_BADGE_STYLES[invoice.status] ?? {
                        background: '#f3f4f6',
                        color: '#6b7280',
                      }
                      const canRecordPayment =
                        invoice.status === 'pending' || invoice.status === 'overdue'
                      const canWaive =
                        invoice.status === 'pending' || invoice.status === 'overdue'

                      return (
                        <tr
                          key={invoice.id}
                          style={{
                            borderBottom: '1px solid var(--color-line)',
                          }}
                        >
                          <td style={{ padding: '14px 16px', color: 'var(--color-ink)' }}>
                            {formatDate(invoice.created_at.split('T')[0])}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--color-ink)', fontWeight: 600 }}>
                            {formatCurrency(invoice.amount)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 12px',
                                borderRadius: 12,
                                fontSize: 13,
                                fontWeight: 600,
                                background: badgeStyle.background,
                                color: badgeStyle.color,
                                textTransform: 'capitalize',
                              }}
                            >
                              {invoice.status}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--color-ink-2)' }}>
                            {formatDate(invoice.due_date)}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                justifyContent: 'flex-end',
                                flexWrap: 'wrap',
                              }}
                            >
                              {canRecordPayment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaymentTarget({
                                      invoiceId: invoice.id,
                                      invoiceAmount: invoice.amount,
                                    })
                                  }
                                  style={{
                                    minHeight: 40,
                                    padding: '6px 14px',
                                    fontSize: 14,
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    color: 'var(--color-purple)',
                                    background: 'var(--color-purple-tint)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Record Payment
                                </button>
                              )}
                              {canWaive && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWaiveTarget({
                                      id: invoice.id,
                                      amount: invoice.amount,
                                    })
                                  }
                                  style={{
                                    minHeight: 40,
                                    padding: '6px 14px',
                                    fontSize: 14,
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Waive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* PAYMENT HISTORY                                                */}
          {/* ============================================================= */}
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
              }}
            >
              Payment History
            </h2>

            {payments.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 32,
                  fontSize: 18,
                  color: 'var(--color-ink-3)',
                  fontStyle: 'italic',
                }}
              >
                No payments recorded
              </div>
            )}

            {payments.length > 0 && (
              <div
                style={{
                  background: 'var(--color-white)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 16,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--color-line)',
                        background: 'var(--color-cream)',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Date
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Amount
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Method
                      </th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment: Payment) => (
                      <tr
                        key={payment.id}
                        style={{
                          borderBottom: '1px solid var(--color-line)',
                        }}
                      >
                        <td style={{ padding: '14px 16px', color: 'var(--color-ink)' }}>
                          {formatTimestamp(payment.paid_at)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--color-ink)', fontWeight: 600 }}>
                          {formatCurrency(payment.amount)}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--color-ink-2)', textTransform: 'capitalize' }}>
                          {payment.method}
                        </td>
                        <td
                          style={{
                            padding: '14px 16px',
                            color: 'var(--color-ink-3)',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {payment.notes ?? '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Generate Invoice Modal */}
      <GenerateInvoiceModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
      />

      {/* Record Payment Modal */}
      {paymentTarget && (
        <RecordPaymentModal
          open={!!paymentTarget}
          onOpenChange={(open) => {
            if (!open) setPaymentTarget(null)
          }}
          invoiceId={paymentTarget.invoiceId}
          invoiceAmount={paymentTarget.invoiceAmount}
        />
      )}

      {/* Waive Confirmation Dialog */}
      <Dialog
        open={!!waiveTarget}
        onOpenChange={(open) => {
          if (!open) setWaiveTarget(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.40)',
              zIndex: 50,
            }}
          />
          <DialogContent
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              background: 'var(--color-white)',
              borderRadius: 20,
              padding: 32,
              maxWidth: 440,
              width: 'calc(100vw - 48px)',
              outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: 'var(--color-ink)',
                margin: '0 0 12px 0',
              }}
            >
              Waive Invoice?
            </DialogTitle>
            <p
              style={{
                fontSize: 16,
                color: 'var(--color-ink-2)',
                lineHeight: 1.5,
                margin: '0 0 24px 0',
              }}
            >
              Waive the {waiveTarget ? formatCurrency(waiveTarget.amount) : ''}{' '}
              invoice? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setWaiveTarget(null)}
                style={{
                  flex: 1,
                  height: 56,
                  background: 'var(--color-white)',
                  color: 'var(--color-ink-2)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWaive}
                disabled={isWaiving}
                style={{
                  flex: 1,
                  height: 56,
                  background: '#6b7280',
                  color: 'var(--color-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: isWaiving ? 'not-allowed' : 'pointer',
                  opacity: isWaiving ? 0.7 : 1,
                }}
              >
                {isWaiving ? 'Waiving...' : 'Waive Invoice'}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
