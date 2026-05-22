import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

/**
 * Login screen — email + password form matching the screens.jsx visual spec.
 *
 * Design requirements:
 * - Atkinson Hyperlegible body font (accessibility)
 * - DM Serif Display italic for "Dance" in the logotype
 * - #8f2db5 purple submit button, minimum 56px height (tap target)
 * - Inline error display in red below the form
 */
export function Login() {
  const { login } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null)
    const { error } = await login(data.email, data.password)
    if (error) {
      setAuthError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-cream)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--color-white)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px 40px 40px',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* LSODance logotype */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.01em',
              color: 'var(--color-purple)',
              display: 'inline-flex',
              alignItems: 'baseline',
            }}
          >
            <span>LSO</span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontStyle: 'italic',
                marginLeft: 1,
              }}
            >
              Dance
            </span>
          </div>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 400,
            color: 'var(--color-ink)',
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          Sign in
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-ink-3)', marginBottom: 32 }}>
          LaShelle School of Dance — Staff
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Email field */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-ink-2)',
                marginBottom: 8,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              {...register('email')}
              style={{
                width: '100%',
                height: 56,
                padding: '0 16px',
                border: `1.5px solid ${errors.email ? 'var(--color-red)' : 'var(--color-line-strong)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 18,
                fontFamily: 'var(--font-body)',
                color: 'var(--color-ink)',
                background: 'var(--color-white)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.email && (
              <p style={{ color: 'var(--color-red)', fontSize: 14, marginTop: 6 }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div style={{ marginBottom: 32 }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-ink-2)',
                marginBottom: 8,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              style={{
                width: '100%',
                height: 56,
                padding: '0 16px',
                border: `1.5px solid ${errors.password ? 'var(--color-red)' : 'var(--color-line-strong)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 18,
                fontFamily: 'var(--font-body)',
                color: 'var(--color-ink)',
                background: 'var(--color-white)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.password && (
              <p style={{ color: 'var(--color-red)', fontSize: 14, marginTop: 6 }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Auth error */}
          {authError && (
            <p
              style={{
                color: 'var(--color-red)',
                fontSize: 16,
                marginBottom: 20,
                padding: '12px 16px',
                background: 'var(--color-red-soft)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {authError}
            </p>
          )}

          {/* Submit button — 56px minimum height, purple, full width */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              minHeight: 56,
              background: isSubmitting ? 'var(--color-purple-deep)' : 'var(--color-purple)',
              color: 'var(--color-white)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 18,
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 2px 0 var(--color-purple-deep)',
            }}
          >
            {isSubmitting ? (
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
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
