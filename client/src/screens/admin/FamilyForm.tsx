import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFamily, useCreateFamily, useUpdateFamily } from '../../hooks/useFamilies'

// Zod schema for family form validation
const familySchema = z.object({
  primary_guardian_name: z.string().min(1, 'Primary guardian name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  secondary_guardian_name: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  address: z.string().optional(),
})

type FamilyFormData = z.infer<typeof familySchema>

/**
 * FamilyForm — create/edit family with all guardian and emergency fields.
 * In edit mode, shows linked students below the form.
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function FamilyForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { data: family, isLoading: familyLoading } = useFamily(isEdit ? id : undefined)
  const createFamily = useCreateFamily()
  const updateFamily = useUpdateFamily(id ?? '')

  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
    defaultValues: {
      primary_guardian_name: '',
      email: '',
      phone: '',
      secondary_guardian_name: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      address: '',
    },
  })

  // Populate form when family data loads in edit mode
  useEffect(() => {
    if (family && isEdit) {
      reset({
        primary_guardian_name: family.primary_guardian_name ?? '',
        email: family.email ?? '',
        phone: family.phone ?? '',
        secondary_guardian_name: family.secondary_guardian_name ?? '',
        emergency_contact_name: family.emergency_contact_name ?? '',
        emergency_contact_phone: family.emergency_contact_phone ?? '',
        address: family.address ?? '',
      })
    }
  }, [family, isEdit, reset])

  // Show loading spinner in edit mode while family data loads
  if (isEdit && familyLoading) {
    return (
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
    )
  }

  const onSubmit = async (data: FamilyFormData) => {
    setSubmitError(null)
    try {
      const payload = {
        primaryGuardianName: data.primary_guardian_name,
        email: data.email,
        phone: data.phone || undefined,
        secondaryGuardianName: data.secondary_guardian_name || undefined,
        emergencyContactName: data.emergency_contact_name || undefined,
        emergencyContactPhone: data.emergency_contact_phone || undefined,
        address: data.address || undefined,
      }

      if (isEdit) {
        await updateFamily.mutateAsync(payload)
      } else {
        await createFamily.mutateAsync(payload)
      }
      navigate('/admin/families')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save family')
    }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    height: 48,
    padding: '12px 16px',
    border: '1px solid var(--color-line)',
    borderRadius: 'var(--radius-sm)',
    width: '100%',
    fontFamily: 'var(--font-body)',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-ink-2)',
    marginBottom: 4,
    display: 'block',
    fontFamily: 'var(--font-body)',
  }

  const errorStyle: React.CSSProperties = {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'var(--font-body)',
  }

  return (
    <div>
      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--color-ink)',
          margin: '0 0 24px 0',
        }}
      >
        {isEdit ? 'Edit Family' : 'Add Family'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Primary Guardian Name */}
        <div>
          <label style={labelStyle}>Primary Guardian Name</label>
          <input {...register('primary_guardian_name')} style={inputStyle} />
          {errors.primary_guardian_name && (
            <p style={errorStyle}>{errors.primary_guardian_name.message}</p>
          )}
        </div>

        {/* Secondary Guardian Name */}
        <div>
          <label style={labelStyle}>Secondary Guardian Name</label>
          <input {...register('secondary_guardian_name')} style={inputStyle} />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" {...register('email')} style={inputStyle} />
          {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div>
          <label style={labelStyle}>Phone</label>
          <input type="tel" {...register('phone')} style={inputStyle} />
        </div>

        {/* Emergency Contact Name */}
        <div>
          <label style={labelStyle}>Emergency Contact Name</label>
          <input {...register('emergency_contact_name')} style={inputStyle} />
        </div>

        {/* Emergency Contact Phone */}
        <div>
          <label style={labelStyle}>Emergency Contact Phone</label>
          <input type="tel" {...register('emergency_contact_phone')} style={inputStyle} />
        </div>

        {/* Address */}
        <div>
          <label style={labelStyle}>Address</label>
          <textarea
            {...register('address')}
            rows={3}
            style={{
              ...inputStyle,
              height: 'auto',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Submit error */}
        {submitError && (
          <p style={{ ...errorStyle, fontSize: 14 }}>{submitError}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={createFamily.isPending || updateFamily.isPending}
            style={{
              background: 'var(--color-purple)',
              color: 'white',
              height: 48,
              minHeight: 56,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              minWidth: 160,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              opacity: (createFamily.isPending || updateFamily.isPending) ? 0.6 : 1,
            }}
          >
            {(createFamily.isPending || updateFamily.isPending) ? 'Saving...' : 'Save Family'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/families')}
            style={{
              background: 'white',
              color: 'var(--color-ink-2)',
              height: 48,
              minHeight: 56,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line-strong)',
              minWidth: 120,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Linked students — edit mode only */}
      {isEdit && family && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-line)', margin: '32px 0' }} />

          <div style={{ maxWidth: 600 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
              }}
            >
              Students in this Family
            </h2>

            {(!family.students || family.students.length === 0) ? (
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-body)',
                }}
              >
                No students linked to this family yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {family.students.map((student) => (
                  <Link
                    key={student.id}
                    to={`/admin/students/${student.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      border: '1px solid var(--color-line)',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      color: 'inherit',
                      fontFamily: 'var(--font-body)',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-purple-tint-strong)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-line)'
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                      }}
                    >
                      {student.first_name} {student.last_name}
                    </span>
                    {!student.active && (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--color-ink-3)',
                          fontStyle: 'italic',
                        }}
                      >
                        (inactive)
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
