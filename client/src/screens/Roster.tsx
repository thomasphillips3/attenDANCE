import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useRoster } from '../hooks/useRoster'
import { useSessions } from '../hooks/useSessions'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store'
import { StudentRow } from '../components/StudentRow'
import { ConfirmModal } from '../components/ConfirmModal'
import { queryClient } from '../App'
import { db } from '../lib/db'
import type { QueuedAttendance } from '../lib/db'

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

const VITE_API_URL = import.meta.env.VITE_API_URL as string

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
export default function Roster() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  // All hooks must be called before any conditional return (React rules of hooks)
  const { students, isLoading, isOffline } = useRoster(sessionId ?? '')
  const { sessions } = useSessions()
  const { session: authSession } = useAuth()
  const { recordSubmittedAt } = useStore()

  // Access token for PATCH /attendance API calls
  const token = authSession?.access_token

  // Find session metadata for header display
  const session = sessions.find((s) => s.id === sessionId)

  // Local optimistic status state — initialized from API data, updated immediately on tap
  const [localStatus, setLocalStatus] = useState<Record<string, string | null>>({})

  // Modal + submit state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  // Guard: if no sessionId in URL params, redirect to class list
  if (!sessionId) {
    return <Navigate to="/" replace />
  }

  // Compute live counts from localStatus
  // presentCount: 'present' OR 'late' both count as attended (ATTN-04)
  const presentCount = Object.values(localStatus).filter(
    (s) => s === 'present' || s === 'late'
  ).length

  const absentCount = Object.values(localStatus).filter((s) => s === 'absent').length

  // unmarkedCount: students with no status recorded yet (null)
  const unmarkedCount = students.length - Object.values(localStatus).filter(Boolean).length

  /**
   * onConfirmSubmit — POST /sessions/:id/submit, then return to ClassList.
   *
   * On success:
   * 1. Records submittedAt in Zustand store so ClassList can show the timestamp
   * 2. Invalidates the sessions/today query so ClassList re-fetches and shows the checkmark
   * 3. Closes the modal and navigates back to ClassList
   */
  const onConfirmSubmit = async () => {
    if (!token) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${VITE_API_URL}/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json() as { sessionId: string; status: string; submittedAt: string }
        // Store submittedAt so ClassList can display "Submitted at H:MM AM"
        recordSubmittedAt(sessionId, data.submittedAt)
        // Invalidate sessions query — ClassList will re-fetch and show the checkmark
        await queryClient.invalidateQueries({ queryKey: ['sessions', 'today'] })
        setIsModalOpen(false)
        navigate('/')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * onMark — full optimistic marking flow (Plan 03).
   *
   * Step 1: Update local UI state immediately (synchronous — no await).
   * Step 2: Generate idempotency key stamped NOW.
   * Step 3: Durable IndexedDB write — must complete before any fetch.
   * Step 4: Fire-and-forget PATCH if online — marks entry synced on success.
   *
   * createdAt is Date.now() called HERE in onMark — not in any callback or timeout.
   * This preserves the tap timestamp for correct chronological queue replay (PITFALLS.md Pitfall 1).
   */
  const onMark = async (studentId: string, status: string) => {
    const attendanceStatus = status as AttendanceStatus

    // Step 1: immediate local UI update — synchronous, no await
    setLocalStatus((prev) => ({ ...prev, [studentId]: attendanceStatus }))

    // Step 2: generate idempotency key stamped at tap time
    const clientId = crypto.randomUUID()

    // Step 3: durable IndexedDB write — must happen before any fetch
    const queueEntry: Omit<QueuedAttendance, 'id'> = {
      clientId,
      studentId,
      sessionId,
      status: attendanceStatus,
      createdAt: Date.now(), // CRITICAL: stamp at tap time, not sync time
      synced: 0,
      retries: 0,
    }
    await db.attendance_queue.add(queueEntry)

    // Step 4: fire-and-forget API call if online
    if (navigator.onLine && token) {
      ;(async () => {
        try {
          const res = await fetch(`${VITE_API_URL}/attendance`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Idempotency-Key': clientId,
            },
            body: JSON.stringify({ sessionId, studentId, status: attendanceStatus }),
          })
          if (res.ok || res.status === 409) {
            await db.attendance_queue.where('clientId').equals(clientId).modify({ synced: 1 })
          }
          // On other errors: stays in queue, drainQueue retries on reconnect
        } catch {
          // Network error: stays in queue, drainQueue retries on reconnect
        }
      })()
    }
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
            onClick={() => navigate('/')}
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
      <main style={{ flex: 1, overflow: 'auto', paddingBottom: 96 }}>
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
              onMark={onMark}
            />
          ))
        )}
      </main>

      {/* Sticky submit bar — full width, above the roster list */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          background: 'var(--color-white)',
          borderTop: '1px solid var(--color-line)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={isSubmitting}
          style={{
            width: '100%',
            minHeight: 56,
            background: isSubmitting ? 'var(--color-purple-deep)' : 'var(--color-purple)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: 14,
            fontSize: 18,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Submit Attendance
        </button>
      </div>

      {/* Confirmation modal */}
      <ConfirmModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={onConfirmSubmit}
        presentCount={presentCount}
        absentCount={absentCount}
        unmarkedCount={unmarkedCount}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
