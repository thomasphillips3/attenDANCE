import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useTuitionPlans, useDeleteTuitionPlan } from '../../hooks/useTuitionPlans'
import { useDiscounts, useCreateDiscount, useDeleteDiscount } from '../../hooks/useDiscounts'
import { useClasses } from '../../hooks/useClasses'
import { useFamilies } from '../../hooks/useFamilies'
import type { TuitionPlan } from '../../hooks/useTuitionPlans'
import type { Discount, CreateDiscountPayload } from '../../hooks/useDiscounts'

const INTERVAL_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  per_session: 'Per Session',
  seasonal: 'Seasonal',
}

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  sibling: 'Sibling',
  scholarship: 'Scholarship',
  staff: 'Staff',
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

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 12px',
  fontSize: 16,
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
  marginBottom: 4,
  fontFamily: 'var(--font-body)',
}

/**
 * BillingPage -- admin billing management with tuition plans and discounts.
 *
 * Two sections:
 * 1. Tuition Plans table with class name, amount, interval, status, actions
 * 2. Discounts table with family/class, type, amount/percent, status, actions
 *
 * "Add Tuition Plan" navigates to TuitionPlanForm.
 * "Add Discount" opens an inline form on this page.
 */
export default function BillingPage() {
  const { data: plans, isLoading: plansLoading } = useTuitionPlans()
  const { data: discounts, isLoading: discountsLoading } = useDiscounts()
  const { data: classes } = useClasses()
  const { data: familiesResponse } = useFamilies()
  const deletePlan = useDeleteTuitionPlan()
  const createDiscount = useCreateDiscount()
  const deleteDiscount = useDeleteDiscount()

  const families = familiesResponse?.data ?? []

  // Deactivate confirmation dialog state
  const [deactivateTarget, setDeactivateTarget] = useState<{
    type: 'plan' | 'discount'
    id: string
    name: string
  } | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Inline discount creation form
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [discountForm, setDiscountForm] = useState<{
    familyId: string
    classId: string
    type: 'sibling' | 'scholarship' | 'staff'
    mode: 'amount' | 'percent'
    value: string
  }>({
    familyId: '',
    classId: '',
    type: 'sibling',
    mode: 'amount',
    value: '',
  })
  const [discountError, setDiscountError] = useState<string | null>(null)

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setIsDeactivating(true)
    try {
      if (deactivateTarget.type === 'plan') {
        await deletePlan.mutateAsync(deactivateTarget.id)
      } else {
        await deleteDiscount.mutateAsync(deactivateTarget.id)
      }
      setDeactivateTarget(null)
    } catch {
      // Error handled by mutation
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleCreateDiscount = async () => {
    setDiscountError(null)

    if (!discountForm.familyId && !discountForm.classId) {
      setDiscountError('Select a family or class (or both)')
      return
    }

    const numValue = parseFloat(discountForm.value)
    if (isNaN(numValue) || numValue <= 0) {
      setDiscountError('Enter a valid amount or percent')
      return
    }

    if (discountForm.mode === 'percent' && numValue > 100) {
      setDiscountError('Percent cannot exceed 100')
      return
    }

    const body: CreateDiscountPayload = {
      type: discountForm.type,
      ...(discountForm.familyId ? { familyId: discountForm.familyId } : {}),
      ...(discountForm.classId ? { classId: discountForm.classId } : {}),
      ...(discountForm.mode === 'amount'
        ? { amount: numValue }
        : { percent: numValue }),
    }

    try {
      await createDiscount.mutateAsync(body)
      setShowDiscountForm(false)
      setDiscountForm({
        familyId: '',
        classId: '',
        type: 'sibling',
        mode: 'amount',
        value: '',
      })
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : 'Failed to create discount')
    }
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Page title + View Invoices link */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          Billing
        </h1>
        <Link
          to="/admin/billing/invoices"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            padding: '0 24px',
            background: 'var(--color-purple)',
            color: 'var(--color-white)',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          View Invoices
        </Link>
      </div>

      {/* ================================================================= */}
      {/* TUITION PLANS SECTION                                             */}
      {/* ================================================================= */}
      <div style={{ marginBottom: 48 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              color: 'var(--color-ink)',
              margin: 0,
            }}
          >
            Tuition Plans
          </h2>
          <Link
            to="/admin/billing/plans/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 24px',
              background: 'var(--color-purple)',
              color: 'var(--color-white)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Tuition Plan
          </Link>
        </div>

        {plansLoading && (
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

        {!plansLoading && (!plans || plans.length === 0) && (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              fontSize: 18,
              color: 'var(--color-ink-3)',
              fontStyle: 'italic',
            }}
          >
            No tuition plans yet
          </div>
        )}

        {!plansLoading && plans && plans.length > 0 && (
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
                    Class
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Amount
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Interval
                  </th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan: TuitionPlan) => (
                  <tr
                    key={plan.id}
                    style={{
                      borderBottom: '1px solid var(--color-line)',
                      opacity: plan.active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: '14px 16px', color: 'var(--color-ink)' }}>
                      {plan.classes?.name ?? 'All Classes'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--color-ink)', fontWeight: 600 }}>
                      {formatCurrency(plan.amount)}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-ink-2)' }}>
                      {INTERVAL_LABELS[plan.interval] ?? plan.interval}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          background: plan.active ? 'var(--color-purple-tint)' : '#f3f4f6',
                          color: plan.active ? 'var(--color-purple)' : 'var(--color-ink-3)',
                        }}
                      >
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link
                          to={`/admin/billing/plans/${plan.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 40,
                            padding: '6px 14px',
                            fontSize: 14,
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            color: 'var(--color-purple)',
                            background: 'var(--color-purple-tint)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            textDecoration: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </Link>
                        {plan.active && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeactivateTarget({
                                type: 'plan',
                                id: plan.id,
                                name: plan.classes?.name ?? 'this tuition plan',
                              })
                            }
                            style={{
                              minHeight: 40,
                              padding: '6px 14px',
                              fontSize: 14,
                              fontFamily: 'var(--font-body)',
                              fontWeight: 600,
                              color: '#dc2626',
                              background: '#fef2f2',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* DISCOUNTS SECTION                                                 */}
      {/* ================================================================= */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              color: 'var(--color-ink)',
              margin: 0,
            }}
          >
            Discounts
          </h2>
          <button
            type="button"
            onClick={() => setShowDiscountForm(!showDiscountForm)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 24px',
              background: showDiscountForm ? 'var(--color-ink-3)' : 'var(--color-purple)',
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
            {showDiscountForm ? 'Cancel' : '+ Add Discount'}
          </button>
        </div>

        {/* Inline discount creation form */}
        {showDiscountForm && (
          <div
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              padding: 24,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxWidth: 600,
            }}
          >
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>
                  Family
                  <select
                    value={discountForm.familyId}
                    onChange={(e) =>
                      setDiscountForm({ ...discountForm, familyId: e.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="">-- Select Family --</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.primary_guardian_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>
                  Class
                  <select
                    value={discountForm.classId}
                    onChange={(e) =>
                      setDiscountForm({ ...discountForm, classId: e.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="">-- Select Class --</option>
                    {(classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <label style={labelStyle}>
                  Type
                  <select
                    value={discountForm.type}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        type: e.target.value as 'sibling' | 'scholarship' | 'staff',
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="sibling">Sibling</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
              </div>
              <div style={{ minWidth: 140 }}>
                <label style={labelStyle}>
                  Mode
                  <select
                    value={discountForm.mode}
                    onChange={(e) =>
                      setDiscountForm({
                        ...discountForm,
                        mode: e.target.value as 'amount' | 'percent',
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="amount">$ Amount</option>
                    <option value="percent">% Percent</option>
                  </select>
                </label>
              </div>
              <div style={{ minWidth: 120 }}>
                <label style={labelStyle}>
                  {discountForm.mode === 'amount' ? 'Amount ($)' : 'Percent (%)'}
                  <input
                    type="number"
                    value={discountForm.value}
                    onChange={(e) =>
                      setDiscountForm({ ...discountForm, value: e.target.value })
                    }
                    style={inputStyle}
                    min={0}
                    max={discountForm.mode === 'percent' ? 100 : undefined}
                    step={discountForm.mode === 'amount' ? '0.01' : '1'}
                    placeholder={discountForm.mode === 'amount' ? '25.00' : '10'}
                  />
                </label>
              </div>
            </div>

            {discountError && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-sm)',
                  color: '#dc2626',
                  fontSize: 14,
                }}
              >
                {discountError}
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleCreateDiscount}
                disabled={createDiscount.isPending}
                style={{
                  height: 48,
                  minWidth: 160,
                  background: 'var(--color-purple)',
                  color: 'var(--color-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: createDiscount.isPending ? 'not-allowed' : 'pointer',
                  opacity: createDiscount.isPending ? 0.7 : 1,
                }}
              >
                {createDiscount.isPending ? 'Creating...' : 'Create Discount'}
              </button>
            </div>
          </div>
        )}

        {discountsLoading && (
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

        {!discountsLoading && (!discounts || discounts.length === 0) && (
          <div
            style={{
              textAlign: 'center',
              padding: 48,
              fontSize: 18,
              color: 'var(--color-ink-3)',
              fontStyle: 'italic',
            }}
          >
            No discounts yet
          </div>
        )}

        {!discountsLoading && discounts && discounts.length > 0 && (
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
                    Family / Class
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Type
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Amount / Percent
                  </th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Status
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-ink-2)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((disc: Discount) => (
                  <tr
                    key={disc.id}
                    style={{
                      borderBottom: '1px solid var(--color-line)',
                      opacity: disc.active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: '14px 16px', color: 'var(--color-ink)' }}>
                      <div>
                        {disc.families?.primary_guardian_name && (
                          <div>{disc.families.primary_guardian_name}</div>
                        )}
                        {disc.classes?.name && (
                          <div style={{ fontSize: 13, color: 'var(--color-ink-3)' }}>
                            {disc.classes.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-ink-2)' }}>
                      {DISCOUNT_TYPE_LABELS[disc.type] ?? disc.type}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--color-ink)', fontWeight: 600 }}>
                      {disc.amount !== null
                        ? formatCurrency(disc.amount)
                        : disc.percent !== null
                          ? `${disc.percent}%`
                          : '--'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          background: disc.active ? 'var(--color-purple-tint)' : '#f3f4f6',
                          color: disc.active ? 'var(--color-purple)' : 'var(--color-ink-3)',
                        }}
                      >
                        {disc.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {disc.active && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeactivateTarget({
                              type: 'discount',
                              id: disc.id,
                              name: disc.families?.primary_guardian_name ?? disc.classes?.name ?? 'this discount',
                            })
                          }
                          style={{
                            minHeight: 40,
                            padding: '6px 14px',
                            fontSize: 14,
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            color: '#dc2626',
                            background: '#fef2f2',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                          }}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* DEACTIVATION CONFIRMATION DIALOG                                  */}
      {/* ================================================================= */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
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
              Deactivate {deactivateTarget?.name}?
            </DialogTitle>
            <p
              style={{
                fontSize: 16,
                color: 'var(--color-ink-2)',
                lineHeight: 1.5,
                margin: '0 0 24px 0',
              }}
            >
              {deactivateTarget?.type === 'plan'
                ? 'This tuition plan will be marked inactive. Existing invoices are not affected.'
                : 'This discount will be marked inactive. It will no longer apply to future invoices.'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                style={{
                  flex: 1,
                  height: 48,
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
                onClick={handleDeactivate}
                disabled={isDeactivating}
                style={{
                  flex: 1,
                  height: 48,
                  background: '#dc2626',
                  color: 'var(--color-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: isDeactivating ? 'not-allowed' : 'pointer',
                  opacity: isDeactivating ? 0.7 : 1,
                }}
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
