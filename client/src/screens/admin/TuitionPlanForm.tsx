import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useTuitionPlan,
  useCreateTuitionPlan,
  useUpdateTuitionPlan,
} from '../../hooks/useTuitionPlans'
import { useClasses } from '../../hooks/useClasses'
import type {
  CreateTuitionPlanPayload,
  UpdateTuitionPlanPayload,
} from '../../hooks/useTuitionPlans'

// ---------------------------------------------------------------------------
// Zod schema for the tuition plan form
// ---------------------------------------------------------------------------
const tuitionPlanSchema = z.object({
  class_id: z.string().optional(),
  amount: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  interval: z.enum(['monthly', 'per_session', 'seasonal']),
})

type TuitionPlanFormData = z.infer<typeof tuitionPlanSchema>

// ---------------------------------------------------------------------------
// Shared styles (matches ClassForm pattern)
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

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#dc2626',
  marginTop: 4,
  fontFamily: 'var(--font-body)',
}

// ---------------------------------------------------------------------------
// TuitionPlanForm component
// ---------------------------------------------------------------------------
export default function TuitionPlanForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: planData, isLoading: planLoading } = useTuitionPlan(id)
  const { data: classes } = useClasses()
  const createPlan = useCreateTuitionPlan()
  const updatePlan = useUpdateTuitionPlan(id ?? '')

  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TuitionPlanFormData>({
    resolver: zodResolver(tuitionPlanSchema),
    defaultValues: {
      class_id: '',
      amount: 0,
      interval: 'monthly',
    },
  })

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (isEdit && planData) {
      reset({
        class_id: planData.class_id ?? '',
        amount: planData.amount,
        interval: planData.interval,
      })
    }
  }, [isEdit, planData, reset])

  const onSubmit = async (data: TuitionPlanFormData) => {
    setSubmitError(null)
    try {
      const classId = data.class_id && data.class_id !== '' ? data.class_id : undefined

      if (isEdit) {
        const body: UpdateTuitionPlanPayload = {
          classId,
          amount: data.amount,
          interval: data.interval,
        }
        await updatePlan.mutateAsync(body)
      } else {
        const body: CreateTuitionPlanPayload = {
          classId,
          amount: data.amount,
          interval: data.interval,
        }
        await createPlan.mutateAsync(body)
      }
      navigate('/admin/billing')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save tuition plan')
    }
  }

  // Loading state for edit mode
  if (isEdit && planLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 48,
          fontFamily: 'var(--font-body)',
        }}
      >
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

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Back link */}
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

      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--color-ink)',
          margin: '12px 0 24px 0',
        }}
      >
        {isEdit ? 'Edit Tuition Plan' : 'Add Tuition Plan'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Class select */}
        <div>
          <label style={labelStyle}>
            Class
            <select {...register('class_id')} style={inputStyle}>
              <option value="">All Classes (default)</option>
              {(classes ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Amount */}
        <div>
          <label style={labelStyle}>
            Amount ($) *
            <input
              type="number"
              {...register('amount')}
              style={inputStyle}
              placeholder="150.00"
              min={0}
              step="0.01"
            />
          </label>
          {errors.amount && <div style={errorStyle}>{errors.amount.message}</div>}
        </div>

        {/* Interval */}
        <div>
          <label style={labelStyle}>
            Billing Interval *
            <select {...register('interval')} style={inputStyle}>
              <option value="monthly">Monthly</option>
              <option value="per_session">Per Session</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </label>
          {errors.interval && <div style={errorStyle}>{errors.interval.message}</div>}
        </div>

        {/* Submit error */}
        {submitError && (
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
            {submitError}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={isSubmitting}
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Tuition Plan'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/billing')}
            style={{
              height: 48,
              minWidth: 100,
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
        </div>
      </form>
    </div>
  )
}
