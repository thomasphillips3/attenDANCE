import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/**
 * ParentLogin — magic link login for parents.
 *
 * No password field. Parents enter their email and receive a magic link
 * via Supabase signInWithOtp. After clicking the link, the session is
 * established and the custom_access_token_hook injects parent role + family_id.
 *
 * Design: matches Login.tsx visual language but simplified for parents.
 * 18px+ body text, 56px+ tap targets, Atkinson Hyperlegible, studio purple.
 */
export default function ParentLogin() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // If already logged in as parent, redirect to dashboard
  if (!loading && session) {
    let role = ''
    try {
      const payloadB64 = session.access_token.split('.')[1]
      const payload = JSON.parse(atob(payloadB64)) as {
        app_metadata?: { role?: string }
      }
      role = payload.app_metadata?.role ?? ''
    } catch {
      // ignore
    }
    if (role === 'parent') {
      return <Navigate to="/parent" replace />
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setSubmitting(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/parent`,
      },
    })

    setSubmitting(false)

    if (otpError) {
      setError('Something went wrong. Please try again.')
      return
    }

    // Always show success — don't leak whether the email exists
    setSent(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-cream)',
        padding: 24,
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
          Parent Portal
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-ink-3)', marginBottom: 32 }}>
          Sign in with your email to view your family&apos;s classes and attendance.
        </p>

        {sent ? (
          /* Success state — check your email */
          <div
            style={{
              background: 'var(--color-purple-tint)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-purple)',
                marginBottom: 8,
                fontFamily: 'var(--font-body)',
              }}
            >
              Check your email
            </p>
            <p style={{ fontSize: 18, color: 'var(--color-ink-2)', fontFamily: 'var(--font-body)' }}>
              We sent a sign-in link to <strong>{email}</strong>. Click the link to access
              your parent portal.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{
                marginTop: 20,
                background: 'none',
                border: 'none',
                color: 'var(--color-purple)',
                textDecoration: 'underline',
                fontSize: 16,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                minHeight: 44,
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Email input form */
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="parent-email"
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
                Email address
              </label>
              <input
                id="parent-email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  border: `1.5px solid ${error ? 'var(--color-red)' : 'var(--color-line-strong)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-ink)',
                  background: 'var(--color-white)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
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
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                minHeight: 56,
                background: submitting ? 'var(--color-purple-deep)' : 'var(--color-purple)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 18,
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 2px 0 var(--color-purple-deep)',
              }}
            >
              {submitting ? (
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
                  Sending link...
                </>
              ) : (
                'Send me a sign-in link'
              )}
            </button>
          </form>
        )}

        {/* Staff login link */}
        <p
          style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 14,
            color: 'var(--color-ink-3)',
          }}
        >
          Staff member?{' '}
          <a
            href="/login"
            style={{
              color: 'var(--color-purple)',
              textDecoration: 'underline',
            }}
          >
            Sign in here
          </a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
