import { useState, useEffect } from 'react'
import { useRoster } from '../hooks/useRoster'
import { useSessions } from '../hooks/useSessions'
import { StudentRow } from '../components/StudentRow'

interface RosterProps {
  sessionId: string
  onBack: () => void
}

/**
 * Roster screen — enrolled students for a single class session.
 *
 * Header (matches screens.jsx spec):
 * - Back arrow button (56x56 touch target, --color-purple)
 * - Class name + time (center)
 * - "{presentCount} Present · {absentCount} Absent" counts line
 *
 * Counts are derived from localStatus (optimistic local state), not the API,
 * so they update immediately when a status button is tapped.
 *
 * presentCount = students where status is 'present' OR 'late' (both attended)
 * absentCount  = students where status is 'absent'
 *
 * onMark handler updates localStatus immediately. Plan 03 will add the
 * IndexedDB write + API call inside this handler.
 *
 * Offline: useRoster sets isOffline: true on network failure; banner shown.
 */
export function Roster({ sessionId, onBack }: RosterProps) {
  const { students, isLoading, isOffline } = useRoster(sessionId)
  const { sessions } = useSessions()

  // Find session metadata for header display
  const session = sessions.find((s) => s.id === sessionId)

  // Local optimistic status state — initialized from API data, updated immediately on tap
  const [localStatus, setLocalStatus] = useState<Record<string, string | null>>({})

  // Initialize localStatus from API data when students load
  useEffect(() => {
    if (students.length === 0) return
    setLocalStatus((prev) => {
      // Only initialize for students not already in local state
      const updates: Record<string, string | null> = {}
      for (const s of students) {
        if (!(s.studentId in prev)) {
          updates[s.studentId] = s.attendanceStatus ?? null
        }
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
    })
  }, [students])

  // Compute live counts from localStatus
  const presentCount = Object.values(localStatus).filter(
    (s) => s === 'present' || s === 'late'
  ).length

  const absentCount = Object.values(localStatus).filter((s) => s === 'absent').length

  // onMark: update local state immediately. Plan 03 adds IndexedDB write + API call here.
  const handleMark = (studentId: string, status: string) => {
    setLocalStatus((prev) => ({ ...prev, [studentId]: status }))
  }

  // Format "HH:MM" 24h → "H:MM AM/PM"
  const formatTime = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':')
    const hour = parseInt(hourStr, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:${minuteStr} ${ampm}`
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-white)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--color-white)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Back arrow — 44px touch target minimum (56px per spec) */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to class list"
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-paper)',
              border: '1px solid var(--color-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              color: 'var(--color-purple)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 6 L9 12 L15 18"
                stroke="var(--color-purple)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Session info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-3)',
                marginBottom: 2,
              }}
            >
              Taking attendance
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-ink)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {session?.className ?? 'Loading…'}
            </div>
            {session && (
              <div
                style={{
                  fontSize: 16,
                  color: 'var(--color-ink-3)',
                  marginTop: 2,
                }}
              >
                {formatTime(session.startTime)}
                {session.instructorName ? ` · ${session.instructorName}` : ''}
              </div>
            )}
          </div>

          {/* Live counts badge */}
          <div
            style={{
              flexShrink: 0,
              textAlign: 'right',
              fontSize: 15,
              color: 'var(--color-ink-3)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: 'var(--color-green)', fontWeight: 700 }}>
              {presentCount} Present
            </span>
            {' · '}
            <span style={{ color: 'var(--color-red)', fontWeight: 700 }}>
              {absentCount} Absent
            </span>
          </div>
        </div>
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
            flexShrink: 0,
          }}
        >
          You're offline — showing cached roster
        </div>
      )}

      {/* Student list */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div
            style={{
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
        ) : students.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
            }}
          >
            <p style={{ fontSize: 18, color: 'var(--color-ink-3)', fontStyle: 'italic' }}>
              No students enrolled.
            </p>
          </div>
        ) : (
          students.map((student) => (
            <StudentRow
              key={student.studentId}
              student={student}
              currentStatus={localStatus[student.studentId] ?? null}
              onMark={handleMark}
            />
          ))
        )}
      </main>
    </div>
  )
}
