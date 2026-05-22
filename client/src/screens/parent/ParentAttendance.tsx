import { useState } from 'react'
import { useParentAttendance } from '../../hooks/useParent'
import { useParentDashboard } from '../../hooks/useParent'

/**
 * ParentAttendance — attendance history for the family's students.
 *
 * Shows a table of attendance records with student name, class name,
 * date, and status. Filterable by student and date range.
 *
 * Design: mobile-first, 18px+ body, 56px+ tap targets, studio purple.
 */

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  present: { bg: 'var(--color-green-soft)', text: 'var(--color-green-deep)' },
  absent: { bg: 'var(--color-red-soft)', text: 'var(--color-red)' },
  late: { bg: 'var(--color-gold-soft)', text: 'var(--color-gold-ink)' },
  excused: { bg: 'var(--color-purple-tint)', text: 'var(--color-purple)' },
}

export default function ParentAttendance() {
  const [studentFilter, setStudentFilter] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: dashboardData } = useParentDashboard()
  const { data, isLoading, error } = useParentAttendance({
    studentId: studentFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const students = dashboardData?.students ?? []
  const records = data?.records ?? []

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 8,
        }}
      >
        Attendance History
      </h1>
      <p style={{ fontSize: 18, color: 'var(--color-ink-3)', marginBottom: 24 }}>
        View attendance records for your students.
      </p>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Student filter */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <label
            htmlFor="student-filter"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-ink-2)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Student
          </label>
          <select
            id="student-filter"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            style={{
              width: '100%',
              height: 48,
              padding: '0 12px',
              border: '1.5px solid var(--color-line-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
              color: 'var(--color-ink)',
              background: 'var(--color-white)',
            }}
          >
            <option value="">All Students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div style={{ flex: 1, minWidth: 150 }}>
          <label
            htmlFor="start-date"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-ink-2)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            From
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              height: 48,
              padding: '0 12px',
              border: '1.5px solid var(--color-line-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
              color: 'var(--color-ink)',
              background: 'var(--color-white)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* End date */}
        <div style={{ flex: 1, minWidth: 150 }}>
          <label
            htmlFor="end-date"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-ink-2)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            To
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              height: 48,
              padding: '0 12px',
              border: '1.5px solid var(--color-line-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
              color: 'var(--color-ink)',
              background: 'var(--color-white)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
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
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: 20,
            background: 'var(--color-red-soft)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-red)',
            fontSize: 18,
          }}
        >
          Failed to load attendance records. Please try again.
        </div>
      )}

      {/* Records table */}
      {!isLoading && !error && (
        <>
          {records.length === 0 ? (
            <p style={{ fontSize: 18, color: 'var(--color-ink-3)', textAlign: 'center', padding: 20 }}>
              No attendance records found for the selected filters.
            </p>
          ) : (
            <div
              style={{
                background: 'var(--color-white)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* Mobile-friendly card list instead of table */}
              {records.map((record) => {
                const sessionDate = record.class_sessions?.session_date
                const className = record.class_sessions?.classes?.name ?? 'Unknown Class'
                const studentName = record.students
                  ? `${record.students.first_name} ${record.students.last_name}`
                  : 'Unknown'
                const statusStyle = STATUS_COLORS[record.status] ?? {
                  bg: 'var(--color-paper)',
                  text: 'var(--color-ink-2)',
                }

                return (
                  <div
                    key={record.id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--color-line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
                        {studentName}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--color-ink-3)', marginTop: 2 }}>
                        {className}
                        {sessionDate && (
                          <span style={{ marginLeft: 8 }}>
                            {new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {record.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <p
            style={{
              fontSize: 14,
              color: 'var(--color-ink-3)',
              marginTop: 12,
              textAlign: 'center',
            }}
          >
            {records.length} record{records.length !== 1 ? 's' : ''} found
          </p>
        </>
      )}
    </div>
  )
}
