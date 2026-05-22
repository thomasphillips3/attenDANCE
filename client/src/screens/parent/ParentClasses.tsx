import { useParentClasses } from '../../hooks/useParent'

/**
 * ParentClasses — weekly class schedule view.
 *
 * Shows all classes the family's students are enrolled in, grouped by
 * day of week. Each card shows class name, time, duration, room,
 * instructor, and which of the family's students are enrolled.
 *
 * Design: mobile-first, 18px+ body, 56px+ tap targets, studio purple.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ParentClasses() {
  const { data, isLoading, error } = useParentClasses()

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
        Failed to load classes. Please try again.
      </div>
    )
  }

  const classes = data?.classes ?? []

  // Group classes by day of week
  const byDay = new Map<number, typeof classes>()
  const unscheduled: typeof classes = []

  for (const cls of classes) {
    if (cls.day_of_week !== null && cls.day_of_week !== undefined) {
      const existing = byDay.get(cls.day_of_week) ?? []
      existing.push(cls)
      byDay.set(cls.day_of_week, existing)
    } else {
      unscheduled.push(cls)
    }
  }

  // Sort days starting from Monday (1) through Sunday (0 at end)
  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => {
    const aAdj = a === 0 ? 7 : a
    const bAdj = b === 0 ? 7 : b
    return aAdj - bAdj
  })

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
        Class Schedule
      </h1>
      <p style={{ fontSize: 18, color: 'var(--color-ink-3)', marginBottom: 24 }}>
        Weekly schedule for your enrolled students.
      </p>

      {classes.length === 0 ? (
        <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>
          No classes found. Your students may not be enrolled yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sortedDays.map(([dayNum, dayClasses]) => (
            <div key={dayNum}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 400,
                  color: 'var(--color-purple)',
                  marginBottom: 12,
                  borderBottom: '2px solid var(--color-purple-tint)',
                  paddingBottom: 6,
                }}
              >
                {DAY_NAMES[dayNum]}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dayClasses
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((cls) => (
                    <div
                      key={cls.id}
                      style={{
                        background: 'var(--color-white)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <strong style={{ fontSize: 18 }}>{cls.name}</strong>
                          {cls.level && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 13,
                                color: 'var(--color-purple)',
                                background: 'var(--color-purple-tint)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              {cls.level}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 16, color: 'var(--color-ink-2)', textAlign: 'right' }}>
                          {cls.start_time}
                          <br />
                          <span style={{ fontSize: 13 }}>{cls.duration_minutes} min</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 15, color: 'var(--color-ink-3)' }}>
                        {cls.staff && (
                          <span>
                            Instructor: {cls.staff.first_name} {cls.staff.last_name}
                          </span>
                        )}
                        {cls.staff && cls.room && <span> &middot; </span>}
                        {cls.room && <span>Room: {cls.room}</span>}
                      </div>

                      {cls.enrolled_students.length > 0 && (
                        <div
                          style={{
                            marginTop: 10,
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          {cls.enrolled_students.map((s) => (
                            <span
                              key={s.id}
                              style={{
                                fontSize: 13,
                                background: 'var(--color-gold-soft)',
                                color: 'var(--color-gold-ink)',
                                padding: '3px 10px',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 700,
                              }}
                            >
                              {s.first_name} {s.last_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Unscheduled classes (workshops, drop-ins without a set day) */}
          {unscheduled.length > 0 && (
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 400,
                  color: 'var(--color-ink-3)',
                  marginBottom: 12,
                  borderBottom: '2px solid var(--color-line)',
                  paddingBottom: 6,
                }}
              >
                Other Classes
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unscheduled.map((cls) => (
                  <div
                    key={cls.id}
                    style={{
                      background: 'var(--color-white)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <strong style={{ fontSize: 18 }}>{cls.name}</strong>
                    <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--color-ink-3)' }}>
                      {cls.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
