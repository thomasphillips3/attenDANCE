import { useState, useEffect } from 'react'
import { useParentProfile, useUpdateParentProfile } from '../../hooks/useParent'

/**
 * ParentProfile — edit family contact information.
 *
 * Form fields: primary guardian, secondary guardian, email, phone,
 * emergency contact name/phone, address.
 *
 * Design: mobile-first, 18px+ body, 56px+ tap targets, studio purple.
 */
export default function ParentProfile() {
  const { data: profile, isLoading, error } = useParentProfile()
  const updateMutation = useUpdateParentProfile()

  const [form, setForm] = useState({
    primaryGuardianName: '',
    secondaryGuardianName: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    address: '',
  })
  const [saved, setSaved] = useState(false)

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        primaryGuardianName: profile.primary_guardian_name ?? '',
        secondaryGuardianName: profile.secondary_guardian_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        emergencyContactName: profile.emergency_contact_name ?? '',
        emergencyContactPhone: profile.emergency_contact_phone ?? '',
        address: profile.address ?? '',
      })
    }
  }, [profile])

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)

    try {
      await updateMutation.mutateAsync(form)
      setSaved(true)
    } catch {
      // Error is shown via updateMutation.error
    }
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
        Failed to load profile. Please try again.
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    height: 56,
    padding: '0 16px',
    border: '1.5px solid var(--color-line-strong)',
    borderRadius: 'var(--radius-md)',
    fontSize: 18,
    fontFamily: 'var(--font-body)',
    color: 'var(--color-ink)',
    background: 'var(--color-white)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-ink-2)',
    marginBottom: 8,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 8,
        }}
      >
        Contact Information
      </h1>
      <p style={{ fontSize: 18, color: 'var(--color-ink-3)', marginBottom: 32 }}>
        Update your family&apos;s contact details. Changes take effect immediately.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-white)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Primary Guardian */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="primary-guardian" style={labelStyle}>
            Primary Guardian
          </label>
          <input
            id="primary-guardian"
            type="text"
            value={form.primaryGuardianName}
            onChange={handleChange('primaryGuardianName')}
            style={inputStyle}
          />
        </div>

        {/* Secondary Guardian */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="secondary-guardian" style={labelStyle}>
            Secondary Guardian
          </label>
          <input
            id="secondary-guardian"
            type="text"
            value={form.secondaryGuardianName}
            onChange={handleChange('secondaryGuardianName')}
            placeholder="Optional"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="profile-email" style={labelStyle}>
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            style={inputStyle}
          />
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="profile-phone" style={labelStyle}>
            Phone
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={form.phone}
            onChange={handleChange('phone')}
            style={inputStyle}
          />
        </div>

        {/* Emergency Contact section */}
        <div
          style={{
            borderTop: '1px solid var(--color-line)',
            paddingTop: 20,
            marginTop: 4,
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-ink)',
              marginBottom: 16,
              fontFamily: 'var(--font-body)',
            }}
          >
            Emergency Contact
          </h3>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="emergency-name" style={labelStyle}>
              Name
            </label>
            <input
              id="emergency-name"
              type="text"
              value={form.emergencyContactName}
              onChange={handleChange('emergencyContactName')}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="emergency-phone" style={labelStyle}>
              Phone
            </label>
            <input
              id="emergency-phone"
              type="tel"
              value={form.emergencyContactPhone}
              onChange={handleChange('emergencyContactPhone')}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Address */}
        <div style={{ marginBottom: 28 }}>
          <label htmlFor="profile-address" style={labelStyle}>
            Address
          </label>
          <textarea
            id="profile-address"
            value={form.address}
            onChange={handleChange('address')}
            rows={3}
            style={{
              ...inputStyle,
              height: 'auto',
              padding: '14px 16px',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Success message */}
        {saved && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--color-green-soft)',
              color: 'var(--color-green-deep)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Contact information saved successfully.
          </div>
        )}

        {/* Error message */}
        {updateMutation.error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--color-red-soft)',
              color: 'var(--color-red)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
              fontSize: 16,
            }}
          >
            {(updateMutation.error as Error).message}
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={updateMutation.isPending}
          style={{
            width: '100%',
            minHeight: 56,
            background: updateMutation.isPending
              ? 'var(--color-purple-deep)'
              : 'var(--color-purple)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 18,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 2px 0 var(--color-purple-deep)',
          }}
        >
          {updateMutation.isPending ? (
            <>
              <span
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
