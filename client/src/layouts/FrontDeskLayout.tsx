import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSyncOnReconnect } from '../lib/sync'
import { OfflineBanner } from '../components/OfflineBanner'

/**
 * FrontDeskLayout -- auth-gated wrapper for the front desk attendance flow.
 *
 * Replaces the auth gating that was in App.tsx AppContent.
 * Renders child routes (ClassList at /, Roster at /roster/:sessionId)
 * via Outlet, plus the OfflineBanner for pending sync count.
 *
 * Auth states:
 * - loading: full-screen spinner (same as original App.tsx)
 * - no session: redirect to /login
 * - session active: render child route + OfflineBanner
 */
export default function FrontDeskLayout() {
  const { session, loading } = useAuth()

  // Register foreground sync listeners -- always active, regardless of screen.
  // iOS-safe: uses 'online' + 'visibilitychange' events only (no BackgroundSync API).
  const { pendingCount } = useSyncOnReconnect(session?.access_token)

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

  return (
    <>
      <Outlet />
      <OfflineBanner pendingCount={pendingCount} />
    </>
  )
}
