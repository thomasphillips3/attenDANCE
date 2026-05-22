import { useState } from 'react'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useFamilies } from '../../hooks/useFamilies'
import { useGenerateInvoice } from '../../hooks/useInvoices'

interface GenerateInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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
 * GenerateInvoiceModal -- select a family and generate an invoice from their
 * active enrollments and tuition plans.
 *
 * Uses Radix Dialog for accessibility. Family dropdown populated from useFamilies
 * hook. On success, shows the generated invoice amount.
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function GenerateInvoiceModal({
  open,
  onOpenChange,
}: GenerateInvoiceModalProps) {
  const [familyId, setFamilyId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    amount: number
    due_date: string
  } | null>(null)

  const { data: familiesResponse } = useFamilies()
  const families = familiesResponse?.data ?? []
  const generateInvoice = useGenerateInvoice()

  const handleGenerate = async () => {
    setError(null)
    setResult(null)

    if (!familyId) {
      setError('Please select a family')
      return
    }

    try {
      const invoice = await generateInvoice.mutateAsync({ familyId })
      setResult({
        amount: invoice.amount,
        due_date: invoice.due_date,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice')
    }
  }

  // Reset form when modal opens/closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen || nextOpen) {
      setFamilyId('')
      setError(null)
      setResult(null)
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
            Generate Invoice
          </DialogTitle>

          <p
            style={{
              fontSize: 16,
              color: 'var(--color-ink-2)',
              fontFamily: 'var(--font-body)',
              margin: '0 0 20px 0',
              lineHeight: 1.5,
            }}
          >
            Generate an invoice for a family based on their active enrollments
            and tuition plans. Applicable discounts are automatically applied.
          </p>

          {/* Success result */}
          {result && (
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--color-purple-tint)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--color-purple)',
                  fontFamily: 'var(--font-body)',
                  marginBottom: 4,
                }}
              >
                Invoice Generated
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Amount: {formatCurrency(result.amount)} -- Due: {result.due_date}
              </div>
            </div>
          )}

          {/* Family select */}
          {!result && (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Family
                </label>
                <select
                  value={familyId}
                  onChange={(e) => setFamilyId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Select a Family --</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.primary_guardian_name}
                    </option>
                  ))}
                </select>
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
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
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
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateInvoice.isPending}
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
                  cursor: generateInvoice.isPending ? 'not-allowed' : 'pointer',
                  opacity: generateInvoice.isPending ? 0.7 : 1,
                }}
              >
                {generateInvoice.isPending ? 'Generating...' : 'Generate Invoice'}
              </button>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
