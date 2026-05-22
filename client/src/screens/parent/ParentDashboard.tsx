import { Link } from 'react-router-dom'
import { useParentDashboard } from '../../hooks/useParent'

/**
 * ParentDashboard — family overview landing page.
 *
 * Shows welcome message with guardian name, student cards with their
 * enrolled classes, and quick navigation links.
 *
 * Design: mobile-first, 18px+ body, 56px+ tap targets, studio purple.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ParentDashboard() {
  const { data, isLoading, error } = useParentDashboard()

  if (isLoading) {
    return (
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
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          background: 'var(--color-red-soft)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-red)',
          fontSize: 18,
        }}
      >
        Failed to load dashboard. Please try again.
      </div>
    )
  }

  if (!data) return null

  const { family, students } = data

  return (
    <div>
      {/* Welcome message */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 8,
        }}
      >
        Welcome, {family.primary_guardian_name.split(' ')[0]}
      </h1>
      <p style={{ fontSize: 18, color: 'var(--color-ink-3)', marginBottom: 32 }}>
        Here is an overview of your family at LSODance.
      </p>

      {/* Quick links */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/parent/classes"
          style={{
            flex: 1,
            minWidth: 140,
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-purple-tint)',
            color: 'var(--color-purple)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 16,
            fontFamily: 'var(--font-body)',
          }}
        >
          Class Schedule
        </Link>
        <Link
          to="/parent/attendance"
          style={{
            flex: 1,
            minWidth: 140,
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-purple-tint)',
            color: 'var(--color-purple)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 16,
            fontFamily: 'var(--font-body)',
          }}
        >
          Attendance
        </Link>
        <Link
          to="/parent/profile"
          style={{
            flex: 1,
            minWidth: 140,
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-purple-tint)',
            color: 'var(--color-purple)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 16,
            fontFamily: 'var(--font-body)',
          }}
        >
          Contact Info
        </Link>
      </div>

      {/* Student cards */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 16,
        }}
      >
        Your Students
      </h2>

      {students.length === 0 ? (
        <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>
          No active students found. Contact the studio if this seems wrong.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {students.map((student) => (
            <div
              key={student.id}
              style={{
                background: 'var(--color-white)',
                borderRadius: 'var(--radius-md)',
                padding: 20,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  marginBottom: 12,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {student.first_name} {student.last_name}
              </h3>

              {student.enrollments.length === 0 ? (
                <p style={{ fontSize: 16, color: 'var(--color-ink-3)' }}>
                  Not currently enrolled in any classes.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {student.enrollments.map((enrollment) => {
                    const cls = enrollment.class
                    if (!cls) return null
                    return (
                      <div
                        key={enrollment.enrollment_id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--color-paper)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 16,
                        }}
                      >
                        <div>
                          <strong>{cls.name}</strong>
                          {cls.level && (
                            <span style={{ color: 'var(--color-ink-3)', marginLeft: 8 }}>
                              {cls.level}
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--color-ink-2)', fontSize: 14, textAlign: 'right' }}>
                          {cls.day_of_week !== null && cls.day_of_week !== undefined
                            ? `${DAY_NAMES[cls.day_of_week]} ${cls.start_time}`
                            : cls.start_time}
                          {cls.room && <span style={{ marginLeft: 8 }}>{cls.room}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
