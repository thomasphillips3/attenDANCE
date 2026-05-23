import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvents, useCreateEvent, useDeleteEvent } from '../../hooks/useEvents'
import type { CreateEventPayload } from '../../hooks/useEvents'

type EventType = 'recital' | 'showcase' | 'workshop' | 'camp'

const EVENT_TYPES: { label: string; value: EventType }[] = [
  { label: 'Recital', value: 'recital' },
  { label: 'Showcase', value: 'showcase' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Camp', value: 'camp' },
]

const TYPE_BADGE_COLORS: Record<EventType, { background: string; color: string }> = {
  recital: { background: 'var(--color-purple-tint)', color: 'var(--color-purple)' },
  showcase: { background: '#dbeafe', color: '#1e40af' },
  workshop: { background: '#fef9c3', color: '#854d0e' },
  camp: { background: '#dcfce7', color: '#166534' },
}

const TYPE_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Recital', value: 'recital' },
  { label: 'Showcase', value: 'showcase' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Camp', value: 'camp' },
]

/**
 * Format a date string (YYYY-MM-DD) for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * EventsPage -- admin event management list.
 *
 * Features:
 * - List of events with name, date, venue, type badge, enrolled count
 * - "New Event" button with inline creation form
 * - Filter by event type and upcoming/past toggle
 * - Click event row to navigate to detail view
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function EventsPage() {
  const navigate = useNavigate()
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formVenue, setFormVenue] = useState('')
  const [formType, setFormType] = useState<EventType>('recital')

  const { data: events, isLoading } = useEvents({
    upcoming: showUpcoming,
    type: typeFilter || undefined,
  })
  const createEvent = useCreateEvent()
  const deleteEvent = useDeleteEvent()

  const handleCreate = () => {
    if (!formName.trim() || !formDate) return

    const payload: CreateEventPayload = {
      name: formName.trim(),
      event_date: formDate,
      type: formType,
    }
    if (formVenue.trim()) {
      payload.venue = formVenue.trim()
    }

    createEvent.mutate(payload, {
      onSuccess: () => {
        setShowForm(false)
        setFormName('')
        setFormDate('')
        setFormVenue('')
        setFormType('recital')
      },
    })
  }

  const handleDelete = (eventId: string, eventName: string) => {
    if (!window.confirm(`Delete "${eventName}"? This will also remove all enrollments and costumes.`)) {
      return
    }
    deleteEvent.mutate(eventId)
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
          Events
        </h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{
            height: 56,
            padding: '0 28px',
            fontSize: 18,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--color-purple)',
            color: 'var(--color-white)',
            transition: 'opacity 150ms',
          }}
        >
          {showForm ? 'Cancel' : 'New Event'}
        </button>
      </div>

      {/* ================================================================= */}
      {/* New Event Form                                                    */}
      {/* ================================================================= */}
      {showForm && (
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: 'var(--color-ink)',
              margin: '0 0 20px 0',
              fontWeight: 400,
            }}
          >
            Create Event
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  marginBottom: 6,
                }}
              >
                Event Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Spring Recital 2026"
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Date */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  marginBottom: 6,
                }}
              >
                Event Date *
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Venue */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  marginBottom: 6,
                }}
              >
                Venue
              </label>
              <input
                type="text"
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
                placeholder="e.g. Community Center"
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Type */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  marginBottom: 6,
                }}
              >
                Type *
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as EventType)}
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'var(--color-white)',
                }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!formName.trim() || !formDate || createEvent.isPending}
              onClick={handleCreate}
              style={{
                height: 56,
                padding: '0 32px',
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: formName.trim() && formDate && !createEvent.isPending ? 'pointer' : 'not-allowed',
                background: formName.trim() && formDate ? 'var(--color-purple)' : 'var(--color-ink-3)',
                color: 'var(--color-white)',
                opacity: createEvent.isPending ? 0.6 : 1,
              }}
            >
              {createEvent.isPending ? 'Creating...' : 'Create Event'}
            </button>

            {createEvent.isError && (
              <span style={{ fontSize: 16, color: '#dc2626', fontWeight: 500 }}>
                {createEvent.error.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Filters: type tabs + upcoming/past toggle                         */}
      {/* ================================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Type filter tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              style={{
                height: 44,
                padding: '0 20px',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background:
                  typeFilter === tab.value
                    ? 'var(--color-purple)'
                    : 'var(--color-cream)',
                color:
                  typeFilter === tab.value
                    ? 'var(--color-white)'
                    : 'var(--color-ink-2)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Upcoming / Past toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setShowUpcoming(true)}
            style={{
              height: 44,
              padding: '0 20px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: showUpcoming ? 'var(--color-purple)' : 'var(--color-cream)',
              color: showUpcoming ? 'var(--color-white)' : 'var(--color-ink-2)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setShowUpcoming(false)}
            style={{
              height: 44,
              padding: '0 20px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: !showUpcoming ? 'var(--color-purple)' : 'var(--color-cream)',
              color: !showUpcoming ? 'var(--color-white)' : 'var(--color-ink-2)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            Past
          </button>
        </div>
      </div>

      {/* Loading spinner */}
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!events || events.length === 0) && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
          }}
        >
          {showUpcoming ? 'No upcoming events' : 'No past events'}
        </div>
      )}

      {/* Events table */}
      {!isLoading && events && events.length > 0 && (
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-line)',
                  background: 'var(--color-cream)',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Event Name
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Venue
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Enrolled
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const badgeStyle = TYPE_BADGE_COLORS[event.type] ?? {
                  background: '#f3f4f6',
                  color: '#6b7280',
                }
                return (
                  <tr
                    key={event.id}
                    onClick={() => navigate(`/admin/events/${event.id}`)}
                    style={{
                      borderBottom: '1px solid var(--color-line)',
                      cursor: 'pointer',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-cream)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = ''
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink)',
                        fontWeight: 600,
                      }}
                    >
                      {event.name}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(event.event_date)}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink-2)',
                      }}
                    >
                      {event.venue ?? '--'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 12px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          background: badgeStyle.background,
                          color: badgeStyle.color,
                          textTransform: 'capitalize',
                        }}
                      >
                        {event.type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                      }}
                    >
                      {event.enrolledCount}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(event.id, event.name)
                        }}
                        style={{
                          height: 36,
                          padding: '0 14px',
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: 'var(--font-body)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-line)',
                          cursor: 'pointer',
                          background: 'var(--color-white)',
                          color: 'var(--color-red-deep)',
                          transition: 'opacity 150ms',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Total count */}
      {!isLoading && events && events.length > 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--color-ink-3)',
          }}
        >
          Showing {events.length} {showUpcoming ? 'upcoming' : 'past'} event{events.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
