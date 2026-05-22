import { useState } from 'react'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useRecordPayment } from '../../hooks/usePayments'

interface RecordPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceAmount: number
  onSuccess?: () => void
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 56,
  padding: '0 16px',
  fontSize: 18,
  fontFamily: 'var(--font-body)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-ink)',
  background: 'var(--color-white)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-ink-2)',
  marginBottom: 6,
  fontFamily: 'var(--font-body)',
}

/**
 * RecordPaymentModal -- record a cash or check payment against an invoice.
 *
 * Uses Radix Dialog for accessibility (focus trap, escape to close, ARIA roles).
 * Amount defaults to the full invoice amount. Method is radio: Cash or Check.
 * Notes is an optional textarea for reference numbers, memos, etc.
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function RecordPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceAmount,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(String(invoiceAmount))
  const [method, setMethod] = useState<'cash' | 'check'>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recordPayment = useRecordPayment()

  const handleSubmit = async () => {
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Enter a valid payment amount')
      return
    }

    try {
      await recordPayment.mutateAsync({
        invoiceId,
        amount: numAmount,
        method,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment')
    }
  }

  // Reset form when modal opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAmount(String(invoiceAmount))
      setMethod('cash')
      setNotes('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
            padding: 28,
            maxWidth: 480,
            width: 'calc(100vw - 48px)',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            outline: 'none',
          }}
        >
          <DialogTitle
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 8px 0',
            }}
          >
            Record Payment
          </DialogTitle>

          <p
            style={{
              fontSize: 16,
              color: 'var(--color-ink-2)',
              fontFamily: 'var(--font-body)',
              margin: '0 0 20px 0',
            }}
          >
            Invoice total: {formatCurrency(invoiceAmount)}
          </p>

          {/* Amount */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Payment Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0.01}
              step="0.01"
              style={inputStyle}
            />
          </div>

          {/* Method -- radio buttons with 56px tap targets */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Payment Method</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setMethod('cash')}
                style={{
                  flex: 1,
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: method === 'cash'
                    ? '2px solid var(--color-purple)'
                    : '1px solid var(--color-line)',
                  background: method === 'cash'
                    ? 'var(--color-purple-tint)'
                    : 'var(--color-white)',
                  color: method === 'cash'
                    ? 'var(--color-purple)'
                    : 'var(--color-ink-2)',
                }}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setMethod('check')}
                style={{
                  flex: 1,
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: method === 'check'
                    ? '2px solid var(--color-purple)'
                    : '1px solid var(--color-line)',
                  background: method === 'check'
                    ? 'var(--color-purple-tint)'
                    : 'var(--color-white)',
                  color: method === 'check'
                    ? 'var(--color-purple)'
                    : 'var(--color-ink-2)',
                }}
              >
                Check
              </button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Check number, receipt reference, etc."
              rows={3}
              style={{
                ...inputStyle,
                height: 'auto',
                padding: '12px 16px',
                resize: 'vertical',
                minHeight: 72,
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                color: '#dc2626',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
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
              onClick={handleSubmit}
              disabled={recordPayment.isPending}
              style={{
                flex: 1,
                height: 56,
                background: 'var(--color-purple)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                cursor: recordPayment.isPending ? 'not-allowed' : 'pointer',
                opacity: recordPayment.isPending ? 0.7 : 1,
              }}
            >
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
