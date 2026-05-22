import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import { useStore } from '../store'
import { ClassCard } from '../components/ClassCard'

/**
 * ClassList screen — today's classes with real data from GET /sessions/today.
 *
 * Header matches screens.jsx spec:
 * - "TODAY" label 14px uppercase tracked --color-ink-3 font-weight 700
 * - Date in DM Serif Display 42px --color-ink
 * - "Good morning/afternoon/evening, Mrs. Goodman." in DM Serif Display 34px --color-purple italic
 * - LSODance logotype top-right
 *
 * Body: spinner while loading, ClassCard list on success, empty state if no classes.
 *
 * Footer: "Signed in as {email} · Front desk iPad" 14px --color-ink-3
 *
 * Offline: useSessions sets isOffline: true on network failure; banner shown.
 */
export function ClassList() {
  const { user, logout } = useAuth()
  const { sessions, isLoading, isOffline } = useSessions()
  const { submittedAtMap } = useStore()
  const navigate = useNavigate()

  const today = new Date()
  const dateLabel = format(today, 'EEEE, MMMM d, yyyy')

  // Time-of-day greeting
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Display name from user metadata; fall back to email prefix
  const displayName =
    user?.user_metadata?.display_name ??
    (user?.email ? user.email.split('@')[0] : 'there')

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-cream)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '40px 24px 24px',
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--color-white)',
        }}
      >
        {/* Top row: date block + logotype */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          {/* Date block */}
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-3)',
                margin: '0 0 4px 0',
              }}
            >
              Today
            </p>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 42,
                fontWeight: 400,
                lineHeight: 1.05,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              {dateLabel}
            </p>
          </div>

          {/* LSODance logotype */}
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '-0.01em',
              color: 'var(--color-purple)',
              display: 'inline-flex',
              alignItems: 'baseline',
              flexShrink: 0,
              marginTop: 4,
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

        {/* Greeting */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1.15,
            color: 'var(--color-purple)',
            margin: '0 0 4px 0',
          }}
        >
          {greeting}, {displayName}.
        </h1>

        <p
          style={{
            fontSize: 19,
            color: 'var(--color-ink-2)',
            margin: 0,
          }}
        >
          Tap a class to take attendance.
        </p>
      </header>

      {/* Offline banner */}
      {isOffline && (
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--color-gold-soft)',
            borderBottom: '1px solid #e8d49a',
            fontSize: 14,
            color: 'var(--color-gold-ink)',
            fontWeight: 700,
          }}
        >
          You're offline — showing cached data
        </div>
      )}

      {/* Body */}
      <main
        style={{
          flex: 1,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {isLoading ? (
          /* Centered spinner */
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                border: '3px solid var(--color-purple-tint-strong)',
                borderTopColor: 'var(--color-purple)',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
            }}
          >
            <p
              style={{
                fontSize: 18,
                color: 'var(--color-ink-3)',
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              No classes scheduled for today.
            </p>
          </div>
        ) : (
          /* Class card list */
          sessions.map((session) => (
            <ClassCard
              key={session.id}
              session={session}
              onTap={(id) => navigate('/roster/' + id)}
              submittedAt={submittedAtMap.get(session.id)}
            />
          ))
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--color-line)',
          background: 'var(--color-white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: 'var(--color-ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Signed in as {user?.email ?? ''} · Front desk iPad
        </span>

        <button
          type="button"
          onClick={logout}
          style={{
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            color: 'var(--color-ink-3)',
            background: 'none',
            border: '1px solid var(--color-line-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 14px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Sign out
        </button>
      </footer>
    </div>
  )
}
