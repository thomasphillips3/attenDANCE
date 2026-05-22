import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useInvoices, useUpdateInvoice } from '../../hooks/useInvoices'
import type { Invoice } from '../../hooks/useInvoices'
import RecordPaymentModal from '../../components/admin/RecordPaymentModal'
import GenerateInvoiceModal from '../../components/admin/GenerateInvoiceModal'

type StatusFilter = '' | 'pending' | 'paid' | 'overdue' | 'waived'

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Waived', value: 'waived' },
]

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
 * InvoicesPage -- admin invoice list with status filters, payment recording,
 * invoice generation, and waive actions.
 *
 * Status filter tabs across the top. Table with family name, amount, status badge,
 * due date, and action buttons. "Generate Invoice" opens a modal to select a family.
 * "Record Payment" opens a modal with amount, method, and notes fields.
 * "Waive" opens a confirmation dialog.
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<{
    invoiceId: string
    invoiceAmount: number
  } | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<{
    id: string
    familyName: string
    amount: number
  } | null>(null)
  const [isWaiving, setIsWaiving] = useState(false)

  const { data: invoicesResponse, isLoading } = useInvoices({
    status: statusFilter || undefined,
  })
  const invoices = invoicesResponse?.data ?? []
  const updateInvoice = useUpdateInvoice()

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

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Link
            to="/admin/billing"
            style={{
              fontSize: 14,
              color: 'var(--color-purple)',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            &larr; Back to Billing
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              color: 'var(--color-ink)',
              margin: '8px 0 0 0',
            }}
          >
            Invoices
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowGenerateModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            padding: '0 28px',
            background: 'var(--color-purple)',
            color: 'var(--color-white)',
            fontSize: 18,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + Generate Invoice
        </button>
      </div>

      {/* Status filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            style={{
              height: 44,
              padding: '0 20px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background:
                statusFilter === tab.value
                  ? 'var(--color-purple)'
                  : 'var(--color-cream)',
              color:
                statusFilter === tab.value
                  ? 'var(--color-white)'
                  : 'var(--color-ink-2)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading spinner */}
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

      {/* Empty state */}
      {!isLoading && invoices.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
          }}
        >
          {statusFilter
            ? `No ${statusFilter} invoices`
            : 'No invoices yet'}
        </div>
      )}

      {/* Invoice table */}
      {!isLoading && invoices.length > 0 && (
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
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Family
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Due Date
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
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
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink)',
                      }}
                    >
                      {invoice.families?.primary_guardian_name ?? 'Unknown'}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                        color: 'var(--color-ink)',
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                      }}
                    >
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
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink-2)',
                      }}
                    >
                      {formatDate(invoice.due_date)}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                      }}
                    >
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
                                familyName:
                                  invoice.families?.primary_guardian_name ??
                                  'this invoice',
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
              invoice for {waiveTarget?.familyName}? This cannot be undone.
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
