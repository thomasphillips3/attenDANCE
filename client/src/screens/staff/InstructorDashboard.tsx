import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * InstructorDashboard -- today's classes for the logged-in instructor.
 *
 * Fetches sessions from GET /staff/me/sessions (defaults to today).
 * Each class card shows: class name, time, room, attendance counts.
 * "Mark Attendance" button links to /roster/{sessionId} (reuses existing roster).
 *
 * Default export required for React.lazy in router.tsx.
 */

interface AttendanceSummary {
  present: number
  absent: number
  late: number
  excused: number
  total: number
}

interface SessionData {
  session_id: string
  class_id: string
  session_date: string
  status: string
  class_name: string
  start_time: string
  duration_minutes: number
  room: string | null
  enrolled_count: number
  attendance: AttendanceSummary
}

export default function InstructorDashboard() {
  const { session } = useAuth()
  const token = session?.access_token

  const { data, isLoading, error } = useQuery<{ data: SessionData[] }>({
    queryKey: ['staff', 'sessions', 'today'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/staff/me/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
    refetchInterval: 30_000,
  })

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const sessions = data?.data ?? []

  // Format 24h time to 12h AM/PM
  function formatTime(time: string): string {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-ink-3)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
          }}
        >
          {dayName} &middot; {dateStr}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--color-ink)',
            lineHeight: 1.1,
            marginTop: 2,
          }}
        >
          My Classes Today
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
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
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 20,
            background: '#fef2f2',
            borderRadius: 'var(--radius-md)',
            color: '#dc2626',
            fontSize: 18,
          }}
        >
          Failed to load today's classes. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sessions.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
            fontFamily: 'var(--font-body)',
          }}
        >
          No classes scheduled for today
        </div>
      )}

      {/* Session cards */}
      {!isLoading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sessions.map((s) => {
            const checkedIn = s.attendance.present + s.attendance.late
            const isComplete = s.status === 'completed'
            const hasAttendance = s.attendance.total > 0

            return (
              <div
                key={s.session_id}
                style={{
                  background: 'var(--color-white)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-line)',
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Left side: class info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 20,
                      color: 'var(--color-ink)',
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    {s.class_name}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--color-ink-3)',
                      fontFamily: 'var(--font-body)',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{formatTime(s.start_time)}</span>
                    <span>{s.duration_minutes} min</span>
                    {s.room && <span>{s.room}</span>}
                  </div>

                  {/* Attendance summary */}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 14,
                      color: 'var(--color-ink-2)',
                      fontFamily: 'var(--font-body)',
                      display: 'flex',
                      gap: 16,
                    }}
                  >
                    <span>
                      <strong style={{ color: 'var(--color-ink)' }}>
                        {hasAttendance ? checkedIn : '\u2014'}
                      </strong>
                      /{s.enrolled_count} checked in
                    </span>
                    {s.attendance.absent > 0 && (
                      <span style={{ color: '#dc2626' }}>
                        {s.attendance.absent} absent
                      </span>
                    )}
                    {isComplete && (
                      <span
                        style={{
                          color: 'var(--color-green-deep)',
                          fontWeight: 700,
                        }}
                      >
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: action button */}
                <Link
                  to={`/roster/${s.session_id}`}
                  style={{
                    background: isComplete
                      ? 'var(--color-paper)'
                      : 'var(--color-purple)',
                    color: isComplete
                      ? 'var(--color-ink-2)'
                      : 'var(--color-white)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'var(--font-body)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isComplete ? 'View Roster' : 'Mark Attendance'}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
