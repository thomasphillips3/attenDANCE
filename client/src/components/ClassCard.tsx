import type { SessionSummary } from '../hooks/useSessions'

interface ClassCardProps {
  session: SessionSummary
  onTap: (id: string) => void
}

/**
 * ClassCard — tappable tile for a single class session.
 *
 * Visual spec from screens.jsx interfaces block:
 * - White bg, border-radius --radius-md, box-shadow --shadow-card, padding 20px 24px
 * - Left: class name 20px bold --color-ink; time + instructor 15px --color-ink-3
 * - Right status badge:
 *     completed  → green circle checkmark + "Done" text in --color-green
 *     scheduled + presentCount > 0 → purple "In Progress" pill
 *     scheduled + presentCount = 0 → grey dot (no badge text)
 * - Full card tappable, min-height 80px
 */
export function ClassCard({ session, onTap }: ClassCardProps) {
  // Format "HH:MM" 24h → "H:MM AM/PM" for display
  const formatTime = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':')
    const hour = parseInt(hourStr, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minuteStr} ${ampm}`
  }

  const timeDisplay = formatTime(session.startTime)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTap(session.id)}
      onKeyDown={(e) => e.key === 'Enter' && onTap(session.id)}
      aria-label={`Open roster for ${session.className} at ${timeDisplay}`}
      style={{
        background: 'var(--color-white)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minHeight: 80,
        cursor: 'pointer',
        border: '1px solid var(--color-line)',
        userSelect: 'none',
      }}
    >
      {/* Left: class info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-ink)',
            lineHeight: 1.2,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {session.className}
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--color-ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {timeDisplay}
          {session.instructorName ? ` · ${session.instructorName}` : ''}
          {session.totalEnrolled > 0 ? ` · ${session.totalEnrolled} students` : ''}
        </div>
      </div>

      {/* Right: status badge */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {session.status === 'completed' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-green)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--color-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6 L5 9 L10 3"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Done</span>
          </div>
        ) : session.status === 'scheduled' && session.presentCount > 0 ? (
          <span
            style={{
              background: 'var(--color-purple-tint)',
              color: 'var(--color-purple-ink)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '5px 12px',
              borderRadius: 999,
            }}
          >
            In Progress
          </span>
        ) : (
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-line-strong)',
            }}
          />
        )}
      </div>
    </div>
  )
}
