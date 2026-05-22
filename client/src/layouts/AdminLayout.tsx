import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AdminSidebar from '../components/admin/AdminSidebar'

/**
 * AdminLayout -- role-gated wrapper for admin screens.
 *
 * Auth + role check:
 * - Loading: spinner
 * - No session: redirect to /login
 * - Non-admin role: redirect to / (front desk)
 * - Admin: render sidebar + child routes via Outlet
 *
 * Role is decoded from JWT app_metadata (server-writable, not user_metadata).
 * This is a UX gate only -- every API endpoint independently checks role.
 * See threat model T-02-01.
 */
export default function AdminLayout() {
  const { session, loading } = useAuth()

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
    return <Navigate to="/login" replace />
  }

  // Decode role from JWT app_metadata (not user_metadata -- STATE.md decision)
  // Client-side equivalent of server auth plugin pattern
  let role = 'front_desk'
  try {
    const payloadB64 = session.access_token.split('.')[1]
    const payload = JSON.parse(atob(payloadB64)) as {
      app_metadata?: { role?: string }
    }
    role = payload.app_metadata?.role ?? 'front_desk'
  } catch {
    // Malformed token -- treat as non-admin
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          background: 'var(--color-cream)',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
