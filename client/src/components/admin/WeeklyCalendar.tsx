/**
 * WeeklyCalendar — CSS Grid weekly schedule showing class blocks.
 *
 * 7 day columns (Sun-Sat) + a time label column on the left.
 * Hour rows from 7 AM to 7 PM (13 rows). Class blocks are positioned
 * by day_of_week (column) and start_time (row), spanning by duration.
 *
 * Accessibility: each block has role="button", tabIndex=0, aria-label,
 * and responds to Enter/Space for keyboard navigation.
 */

export interface CalendarClass {
  id: string
  name: string
  dayOfWeek: number       // 0=Sun, 6=Sat
  startTime: string       // "HH:MM" 24h
  durationMinutes: number
  instructorName?: string
  room?: string
  enrolledCount: number
  capacity: number | null
}

interface WeeklyCalendarProps {
  classes: CalendarClass[]
  onClassClick?: (classId: string) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const START_HOUR = 7
const END_HOUR = 20
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)

function formatHourLabel(hour: number): string {
  if (hour === 12) return '12p'
  if (hour > 12) return `${hour - 12}p`
  return `${hour}a`
}

function formatTimeForLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`
}

export default function WeeklyCalendar({ classes, onClassClick }: WeeklyCalendarProps) {
  const handleClick = (classId: string) => {
    onClassClick?.(classId)
  }

  const handleKeyDown = (e: React.KeyboardEvent, classId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClassClick?.(classId)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px repeat(7, 1fr)',
        gridTemplateRows: `40px repeat(${HOURS.length}, 60px)`,
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--color-white)',
        position: 'relative',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header row: empty corner + day labels */}
      <div
        style={{
          gridRow: 1,
          gridColumn: 1,
          borderBottom: '1px solid var(--color-line)',
          borderRight: '1px solid var(--color-line)',
          background: 'var(--color-cream)',
        }}
      />
      {DAYS.map((day, i) => (
        <div
          key={day}
          style={{
            gridRow: 1,
            gridColumn: i + 2,
            padding: 8,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            borderBottom: '1px solid var(--color-line)',
            borderRight: i < 6 ? '1px solid var(--color-line)' : undefined,
            background: 'var(--color-cream)',
            color: 'var(--color-ink)',
          }}
        >
          {day}
        </div>
      ))}

      {/* Time labels + grid cells */}
      {HOURS.map((hour, rowIdx) => (
        <div key={`time-${hour}`} style={{ display: 'contents' }}>
          {/* Time label */}
          <div
            style={{
              gridRow: rowIdx + 2,
              gridColumn: 1,
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--color-ink-3)',
              borderRight: '1px solid var(--color-line)',
              borderBottom: rowIdx < HOURS.length - 1 ? '1px solid var(--color-line)' : undefined,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              fontFamily: 'var(--font-body)',
            }}
          >
            {formatHourLabel(hour)}
          </div>

          {/* Grid cells for each day */}
          {DAYS.map((day, colIdx) => (
            <div
              key={`cell-${hour}-${day}`}
              style={{
                gridRow: rowIdx + 2,
                gridColumn: colIdx + 2,
                borderBottom: rowIdx < HOURS.length - 1 ? '1px solid var(--color-line)' : undefined,
                borderRight: colIdx < 6 ? '1px solid var(--color-line)' : undefined,
                position: 'relative',
              }}
            />
          ))}
        </div>
      ))}

      {/* Class blocks — positioned by grid column (day) and row (hour) */}
      {classes
        .filter((cls) => cls.dayOfWeek !== null && cls.dayOfWeek !== undefined)
        .map((cls) => {
          const [h, m] = cls.startTime.split(':').map(Number)

          // Calculate grid position
          const gridColumn = cls.dayOfWeek + 2
          const rowStart = h - START_HOUR + 2
          const spanRows = Math.max(1, Math.ceil(cls.durationMinutes / 60))

          // Skip classes outside the visible hour range
          if (h < START_HOUR || h >= END_HOUR) return null

          const ariaLabel = `${cls.name}, ${FULL_DAYS[cls.dayOfWeek]} ${formatTimeForLabel(cls.startTime)}, ${cls.enrolledCount} of ${cls.capacity ?? 'unlimited'} enrolled`

          return (
            <div
              key={cls.id}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              onClick={() => handleClick(cls.id)}
              onKeyDown={(e) => handleKeyDown(e, cls.id)}
              style={{
                gridColumn,
                gridRow: `${rowStart} / span ${spanRows}`,
                background: 'var(--color-purple-tint)',
                borderLeft: '3px solid var(--color-purple)',
                borderRadius: 6,
                padding: '4px 8px',
                margin: `${m > 0 ? Math.round((m / 60) * 60) : 0}px 2px 2px 2px`,
                fontSize: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                minHeight: 0,
                transition: 'background 150ms',
                zIndex: 1,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--color-purple-tint-strong)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--color-purple-tint)'
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {cls.name}
              </div>
              {cls.instructorName && (
                <div
                  style={{
                    color: 'var(--color-ink-3)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cls.instructorName}
                </div>
              )}
              <div style={{ color: 'var(--color-ink-3)' }}>
                {cls.enrolledCount}/{cls.capacity ?? '--'}
              </div>
            </div>
          )
        })}
    </div>
  )
}
