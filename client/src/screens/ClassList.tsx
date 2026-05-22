import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'

/**
 * ClassList screen — shell for Phase 1.
 *
 * Displays:
 * - "Today" label + current date formatted as "Saturday, May 23, 2026"
 * - "Good morning, Mrs. Goodman." greeting in purple italic DM Serif Display 34px
 * - Signed-in user email in footer
 * - Empty state: "Loading classes..." in --color-ink-3
 *
 * Real class cards are wired in Plan 02 when the roster API is available.
 * Accepts no props — reads user from useAuth.
 */
export function ClassList() {
  const { user, logout } = useAuth()

  const today = new Date()
  const dateLabel = format(today, 'EEEE, MMMM d, yyyy')

  // Extract a display name from user metadata if available; fall back to email
  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'there'

  // Derive time-of-day greeting
  const hour = today.getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

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
        {/* Date label */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-3)',
            marginBottom: 6,
          }}
        >
          Today &mdash; {dateLabel}
        </p>

        {/* Greeting */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1.15,
            color: 'var(--color-purple)',
            margin: 0,
          }}
        >
          {greeting}, {displayName}.
        </h1>
      </header>

      {/* Body — empty state (real cards added in Plan 02) */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <p
          style={{
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
          }}
        >
          Loading classes...
        </p>
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
          {user?.email ?? ''}
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
