import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClasses } from '../../hooks/useClasses'
import WeeklyCalendar from '../../components/admin/WeeklyCalendar'
import type { CalendarClass } from '../../components/admin/WeeklyCalendar'

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format "16:00" -> "4:00 PM"
 */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Compute end time by adding duration to start time.
 */
function formatEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const totalMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return formatTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
}

/**
 * ClassesPage — class list with toggle between Calendar and List views.
 *
 * Calendar view: WeeklyCalendar CSS Grid with class blocks.
 * List view: vertical card list with schedule, instructor, enrollment info.
 */
export default function ClassesPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const { data: classes, isLoading } = useClasses()
  const navigate = useNavigate()

  // Map classes to CalendarClass shape for WeeklyCalendar
  const calendarClasses: CalendarClass[] = (classes ?? [])
    .filter((cls) => cls.day_of_week !== null)
    .map((cls) => ({
      id: cls.id,
      name: cls.name,
      dayOfWeek: cls.day_of_week as number,
      startTime: cls.start_time,
      durationMinutes: cls.duration_minutes,
      instructorName: cls.staff
        ? `${cls.staff.first_name} ${cls.staff.last_name}`
        : undefined,
      room: cls.room ?? undefined,
      enrolledCount: cls.enrolledCount ?? 0,
      capacity: cls.capacity,
    }))

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          Classes
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View toggle */}
          <div style={{ display: 'flex' }}>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              style={{
                height: 40,
                padding: '8px 16px',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                fontWeight: viewMode === 'calendar' ? 700 : 400,
                background: viewMode === 'calendar' ? 'var(--color-purple)' : 'var(--color-white)',
                color: viewMode === 'calendar' ? 'var(--color-white)' : 'var(--color-ink-2)',
                border: viewMode === 'calendar' ? 'none' : '1px solid var(--color-line)',
                borderRadius: '8px 0 0 8px',
                cursor: 'pointer',
              }}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                height: 40,
                padding: '8px 16px',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                fontWeight: viewMode === 'list' ? 700 : 400,
                background: viewMode === 'list' ? 'var(--color-purple)' : 'var(--color-white)',
                color: viewMode === 'list' ? 'var(--color-white)' : 'var(--color-ink-2)',
                border: viewMode === 'list' ? 'none' : '1px solid var(--color-line)',
                borderRadius: '0 8px 8px 0',
                cursor: 'pointer',
              }}
            >
              List
            </button>
          </div>

          {/* Add Class button */}
          <Link
            to="/admin/classes/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              padding: '0 24px',
              background: 'var(--color-purple)',
              color: 'var(--color-white)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Class
          </Link>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 48,
          }}
        >
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

      {/* Empty state */}
      {!isLoading && (!classes || classes.length === 0) && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
          }}
        >
          No classes yet
        </div>
      )}

      {/* Calendar view */}
      {!isLoading && classes && classes.length > 0 && viewMode === 'calendar' && (
        <WeeklyCalendar
          classes={calendarClasses}
          onClassClick={(id) => navigate(`/admin/classes/${id}`)}
        />
      )}

      {/* List view */}
      {!isLoading && classes && classes.length > 0 && viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {classes.map((cls) => (
            <Link
              key={cls.id}
              to={`/admin/classes/${cls.id}`}
              style={{
                display: 'block',
                background: 'var(--color-white)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                textDecoration: 'none',
                opacity: cls.active ? 1 : 0.5,
                transition: 'box-shadow 150ms',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {cls.name}
                    {!cls.active && (
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--color-ink-3)',
                          fontWeight: 400,
                          marginLeft: 8,
                        }}
                      >
                        (Inactive)
                      </span>
                    )}
                  </div>

                  {cls.day_of_week !== null && (
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--color-ink-2)',
                        marginTop: 4,
                      }}
                    >
                      {FULL_DAYS[cls.day_of_week]} {formatTime(cls.start_time)} -{' '}
                      {formatEndTime(cls.start_time, cls.duration_minutes)}
                    </div>
                  )}

                  {cls.staff && (
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--color-ink-3)',
                        marginTop: 2,
                      }}
                    >
                      {cls.staff.first_name} {cls.staff.last_name}
                    </div>
                  )}
                </div>

                {/* Enrollment pill */}
                <span
                  style={{
                    background: 'var(--color-purple-tint)',
                    color: 'var(--color-purple)',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cls.enrolledCount}/{cls.capacity ?? 'Open'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
