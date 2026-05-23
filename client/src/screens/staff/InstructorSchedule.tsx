import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'

/**
 * InstructorSchedule -- weekly view of the instructor's assigned classes.
 *
 * Fetches from GET /staff/me/schedule. Displays classes grouped by day of week
 * in a card grid. Shows class name, time, duration, room, and enrollment count.
 *
 * Default export required for React.lazy in router.tsx.
 */

interface ClassData {
  id: string
  name: string
  day_of_week: number | null
  start_time: string
  duration_minutes: number
  room: string | null
  capacity: number | null
  enrolled_count: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function InstructorSchedule() {
  const { session } = useAuth()
  const token = session?.access_token

  const { data, isLoading, error } = useQuery<{ data: ClassData[] }>({
    queryKey: ['staff', 'schedule'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/staff/me/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch schedule: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })

  const classes = data?.data ?? []

  // Group classes by day_of_week
  const byDay = new Map<number, ClassData[]>()
  for (const cls of classes) {
    const day = cls.day_of_week ?? -1
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(cls)
  }

  // Sort days (0=Sunday through 6=Saturday), unassigned (-1) at end
  const sortedDays = [...byDay.keys()].sort((a, b) => {
    if (a === -1) return 1
    if (b === -1) return -1
    return a - b
  })

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
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 24,
        }}
      >
        My Weekly Schedule
      </h1>

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
          Failed to load schedule. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && classes.length === 0 && (
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
          No classes assigned to you yet
        </div>
      )}

      {/* Schedule grouped by day */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sortedDays.map((dayNum) => {
            const dayClasses = byDay.get(dayNum) ?? []
            const dayLabel = dayNum === -1 ? 'Unscheduled' : DAY_NAMES[dayNum]

            // Highlight today
            const todayDow = new Date().getDay()
            const isToday = dayNum === todayDow

            return (
              <div key={dayNum}>
                {/* Day header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 20,
                      fontWeight: 400,
                      color: isToday ? 'var(--color-purple)' : 'var(--color-ink)',
                      margin: 0,
                    }}
                  >
                    {dayLabel}
                  </h2>
                  {isToday && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-purple)',
                        background: 'var(--color-purple-tint)',
                        padding: '2px 8px',
                        borderRadius: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Today
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--color-ink-3)' }}>
                    {dayClasses.length} class{dayClasses.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Class cards for this day */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayClasses.map((cls) => (
                    <div
                      key={cls.id}
                      style={{
                        background: 'var(--color-white)',
                        border: '1px solid var(--color-line)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--color-ink)',
                          }}
                        >
                          {cls.name}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            color: 'var(--color-ink-3)',
                            marginTop: 2,
                            display: 'flex',
                            gap: 12,
                          }}
                        >
                          <span>{formatTime(cls.start_time)}</span>
                          <span>{cls.duration_minutes} min</span>
                          {cls.room && <span>{cls.room}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 22,
                            color: 'var(--color-purple)',
                          }}
                        >
                          {cls.enrolled_count}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-ink-3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {cls.capacity ? `of ${cls.capacity}` : 'enrolled'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Weekly summary */}
          <div
            style={{
              background: 'var(--color-purple-tint)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  color: 'var(--color-purple)',
                }}
              >
                {classes.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Classes / week
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  color: 'var(--color-purple)',
                }}
              >
                {sortedDays.filter((d) => d >= 0).length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Days teaching
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26,
                  color: 'var(--color-purple)',
                }}
              >
                {classes.reduce((sum, c) => sum + c.enrolled_count, 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Total students
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
