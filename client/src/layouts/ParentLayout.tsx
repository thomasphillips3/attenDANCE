import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * ParentLayout — auth + role gate for the parent portal.
 *
 * Auth check:
 * - Loading: spinner
 * - No session: redirect to /parent/login
 * - Non-parent role: redirect to / (front desk) or /admin
 * - Parent: render mobile-first nav + child routes via Outlet
 *
 * Role is decoded from JWT app_metadata (server-writable only).
 * This is a UX gate — every API endpoint independently checks role.
 *
 * Design: mobile-first, 18px+ body text, 56px+ tap targets,
 * Atkinson Hyperlegible body, studio purple branding.
 */

const NAV_ITEMS = [
  { path: '/parent', label: 'Home', exact: true },
  { path: '/parent/classes', label: 'Classes' },
  { path: '/parent/attendance', label: 'Attendance' },
  { path: '/parent/invoices', label: 'Invoices' },
  { path: '/parent/profile', label: 'Profile' },
]

export default function ParentLayout() {
  const { session, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-cream)',
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

  if (!session) {
    return <Navigate to="/parent/login" replace />
  }

  // Decode role from JWT app_metadata
  let role = ''
  try {
    const payloadB64 = session.access_token.split('.')[1]
    const payload = JSON.parse(atob(payloadB64)) as {
      app_metadata?: { role?: string }
    }
    role = payload.app_metadata?.role ?? ''
  } catch {
    // Malformed token — treat as unauthorized
  }

  if (role !== 'parent') {
    // Staff users trying to access parent portal — redirect to their home
    return <Navigate to="/" replace />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-cream)' }}>
      {/* Header */}
      <header
        style={{
          background: 'var(--color-purple)',
          color: 'var(--color-white)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 22,
            display: 'flex',
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              marginLeft: 10,
              opacity: 0.8,
            }}
          >
            Parent Portal
          </span>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'var(--color-white)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 16px',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            minHeight: 40,
          }}
        >
          Sign out
        </button>
      </header>

      {/* Navigation — horizontal tabs, mobile-friendly */}
      <nav
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--color-white)',
          overflowX: 'auto',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--color-purple)' : 'var(--color-ink-2)',
                textDecoration: 'none',
                borderBottom: isActive ? '3px solid var(--color-purple)' : '3px solid transparent',
                whiteSpace: 'nowrap',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Main content */}
      <main style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
