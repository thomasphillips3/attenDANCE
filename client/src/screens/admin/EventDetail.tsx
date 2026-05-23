import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useEvent,
  useUpdateEvent,
  useEnrollStudents,
  useRemoveEnrollment,
  useCreateCostume,
  useUpdateCostume,
} from '../../hooks/useEvents'
import type { EnrolledStudent, CostumeEntry } from '../../hooks/useEvents'
import { useStudents } from '../../hooks/useStudents'

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatEnrolledDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * EventDetail -- admin event detail with enrollment management and costume tracking.
 *
 * Sections:
 * 1. Event header with edit capability
 * 2. Enrolled students table with add/remove
 * 3. Costume tracking grid with status checkboxes
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: event, isLoading } = useEvent(id)
  const updateEvent = useUpdateEvent(id ?? '')
  const enrollStudents = useEnrollStudents(id ?? '')
  const removeEnrollment = useRemoveEnrollment(id ?? '')
  const createCostume = useCreateCostume(id ?? '')
  const updateCostume = useUpdateCostume(id ?? '')

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editType, setEditType] = useState<EventType>('recital')

  // Student picker modal
  const [showStudentPicker, setShowStudentPicker] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const { data: studentsResponse } = useStudents({ active: true })
  const allStudents = studentsResponse?.data ?? []

  const startEditing = () => {
    if (!event) return
    setEditName(event.name)
    setEditDate(event.event_date)
    setEditVenue(event.venue ?? '')
    setEditType(event.type)
    setEditing(true)
  }

  const handleSave = () => {
    updateEvent.mutate(
      {
        name: editName.trim(),
        event_date: editDate,
        venue: editVenue.trim() || undefined,
        type: editType,
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const handleRemoveStudent = (studentId: string, studentName: string) => {
    if (!window.confirm(`Remove ${studentName} from this event?`)) return
    removeEnrollment.mutate(studentId)
  }

  const handleEnrollSelected = () => {
    if (selectedStudentIds.length === 0) return
    enrollStudents.mutate(selectedStudentIds, {
      onSuccess: () => {
        setShowStudentPicker(false)
        setSelectedStudentIds([])
      },
    })
  }

  const handleToggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((sid) => sid !== studentId)
        : [...prev, studentId]
    )
  }

  const handleCostumeToggle = (
    costume: CostumeEntry,
    field: 'ordered' | 'received' | 'paid'
  ) => {
    updateCostume.mutate({
      costumeId: costume.id,
      [field]: !costume[field],
    })
  }

  const handleAddCostume = (studentId: string) => {
    createCostume.mutate({ student_id: studentId })
  }

  // Loading
  if (isLoading) {
    return (
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
    )
  }

  if (!event) {
    return (
      <div style={{ padding: 48, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>Event not found</p>
        <button
          type="button"
          onClick={() => navigate('/admin/events')}
          style={{
            marginTop: 16,
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
          }}
        >
          Back to Events
        </button>
      </div>
    )
  }

  const badgeStyle = TYPE_BADGE_COLORS[event.type] ?? {
    background: '#f3f4f6',
    color: '#6b7280',
  }

  // Determine which enrolled students don't have a costume entry yet
  const enrolledIds = new Set(event.enrollments.map((e: EnrolledStudent) => e.student_id))
  const costumeStudentIds = new Set(event.costumes.map((c: CostumeEntry) => c.student_id))
  const studentsWithoutCostume = event.enrollments.filter(
    (e: EnrolledStudent) => !costumeStudentIds.has(e.student_id)
  )

  // Costume summary
  const totalCostumes = event.costumes.length
  const orderedCount = event.costumes.filter((c: CostumeEntry) => c.ordered).length
  const receivedCount = event.costumes.filter((c: CostumeEntry) => c.received).length
  const paidCount = event.costumes.filter((c: CostumeEntry) => c.paid).length

  // Students not yet enrolled (for the picker)
  const availableStudents = allStudents.filter((s) => !enrolledIds.has(s.id))

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/admin/events')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 16,
          color: 'var(--color-purple)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          padding: 0,
          marginBottom: 16,
        }}
      >
        &larr; Back to Events
      </button>

      {/* ================================================================= */}
      {/* Event Header                                                      */}
      {/* ================================================================= */}
      <div
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          marginBottom: 24,
        }}
      >
        {!editing ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 32,
                    color: 'var(--color-ink)',
                    margin: '0 0 8px 0',
                  }}
                >
                  {event.name}
                </h1>
                <div
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: 16,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  <span>{formatDate(event.event_date)}</span>
                  {event.venue && <span>{event.venue}</span>}
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
                </div>
              </div>
              <button
                type="button"
                onClick={startEditing}
                style={{
                  height: 44,
                  padding: '0 20px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  cursor: 'pointer',
                  background: 'var(--color-white)',
                  color: 'var(--color-ink-2)',
                }}
              >
                Edit
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--color-ink)',
                margin: '0 0 20px 0',
                fontWeight: 400,
              }}
            >
              Edit Event
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
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
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
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
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
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
                  Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as EventType)}
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
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{
                  height: 56,
                  padding: '0 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  cursor: 'pointer',
                  background: 'var(--color-white)',
                  color: 'var(--color-ink-2)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateEvent.isPending}
                style={{
                  height: 56,
                  padding: '0 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: updateEvent.isPending ? 'not-allowed' : 'pointer',
                  background: 'var(--color-purple)',
                  color: 'var(--color-white)',
                  opacity: updateEvent.isPending ? 0.6 : 1,
                }}
              >
                {updateEvent.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* Enrolled Students                                                 */}
      {/* ================================================================= */}
      <div
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: 'var(--color-ink)',
              margin: 0,
              fontWeight: 400,
            }}
          >
            Enrolled Students ({event.enrollments.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setSelectedStudentIds([])
              setShowStudentPicker(true)
            }}
            style={{
              height: 44,
              padding: '0 20px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--color-purple)',
              color: 'var(--color-white)',
            }}
          >
            Add Students
          </button>
        </div>

        {event.enrollments.length === 0 ? (
          <p
            style={{
              fontSize: 16,
              color: 'var(--color-ink-3)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            No students enrolled yet
          </p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 0',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Student Name
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 0',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Enrolled
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 0',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {event.enrollments.map((enrollment: EnrolledStudent) => (
                <tr
                  key={enrollment.id}
                  style={{ borderBottom: '1px solid var(--color-line)' }}
                >
                  <td style={{ padding: '12px 0', color: 'var(--color-ink)' }}>
                    {enrollment.students.first_name} {enrollment.students.last_name}
                  </td>
                  <td style={{ padding: '12px 0', color: 'var(--color-ink-2)' }}>
                    {formatEnrolledDate(enrollment.enrolled_at)}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveStudent(
                          enrollment.student_id,
                          `${enrollment.students.first_name} ${enrollment.students.last_name}`
                        )
                      }
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
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ================================================================= */}
      {/* Student Picker Modal                                              */}
      {/* ================================================================= */}
      {showStudentPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--color-white)',
              borderRadius: 'var(--radius-md)',
              padding: 32,
              maxWidth: 520,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              fontFamily: 'var(--font-body)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
                fontWeight: 400,
              }}
            >
              Add Students to Event
            </h3>

            {availableStudents.length === 0 ? (
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--color-ink-3)',
                  fontStyle: 'italic',
                }}
              >
                All active students are already enrolled
              </p>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {availableStudents.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id)
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleToggleStudentSelection(student.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        minHeight: 48,
                        padding: '8px 12px',
                        fontSize: 16,
                        fontFamily: 'var(--font-body)',
                        fontWeight: isSelected ? 600 : 400,
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected
                          ? '2px solid var(--color-purple)'
                          : '1px solid var(--color-line)',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'var(--color-purple-tint)'
                          : 'var(--color-white)',
                        color: isSelected
                          ? 'var(--color-purple)'
                          : 'var(--color-ink)',
                        marginBottom: 6,
                        textAlign: 'left',
                        transition: 'all 150ms',
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: isSelected
                            ? '2px solid var(--color-purple)'
                            : '2px solid var(--color-ink-3)',
                          background: isSelected
                            ? 'var(--color-purple)'
                            : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: 'var(--color-white)',
                          fontSize: 14,
                        }}
                      >
                        {isSelected ? '\u2713' : ''}
                      </span>
                      {student.first_name} {student.last_name}
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowStudentPicker(false)}
                style={{
                  height: 56,
                  padding: '0 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  cursor: 'pointer',
                  background: 'var(--color-white)',
                  color: 'var(--color-ink-2)',
                }}
              >
                Cancel
              </button>
              {availableStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handleEnrollSelected}
                  disabled={selectedStudentIds.length === 0 || enrollStudents.isPending}
                  style={{
                    height: 56,
                    padding: '0 24px',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor:
                      selectedStudentIds.length > 0 && !enrollStudents.isPending
                        ? 'pointer'
                        : 'not-allowed',
                    background:
                      selectedStudentIds.length > 0
                        ? 'var(--color-purple)'
                        : 'var(--color-ink-3)',
                    color: 'var(--color-white)',
                    opacity: enrollStudents.isPending ? 0.6 : 1,
                  }}
                >
                  {enrollStudents.isPending
                    ? 'Enrolling...'
                    : `Enroll ${selectedStudentIds.length} Student${selectedStudentIds.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Costume Tracking                                                  */}
      {/* ================================================================= */}
      <div
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--color-ink)',
            margin: '0 0 8px 0',
            fontWeight: 400,
          }}
        >
          Costume Tracking
        </h2>

        {/* Summary line */}
        {totalCostumes > 0 && (
          <p
            style={{
              fontSize: 16,
              color: 'var(--color-ink-2)',
              margin: '0 0 16px 0',
            }}
          >
            {orderedCount} of {totalCostumes} ordered, {receivedCount} received,{' '}
            {paidCount} paid
          </p>
        )}

        {/* Add costume buttons for enrolled students without one */}
        {studentsWithoutCostume.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-ink-2)',
                margin: '0 0 8px 0',
              }}
            >
              Add costume for:
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {studentsWithoutCostume.map((enrollment: EnrolledStudent) => (
                <button
                  key={enrollment.student_id}
                  type="button"
                  onClick={() => handleAddCostume(enrollment.student_id)}
                  disabled={createCostume.isPending}
                  style={{
                    minHeight: 40,
                    padding: '6px 14px',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-line)',
                    cursor: createCostume.isPending ? 'not-allowed' : 'pointer',
                    background: 'var(--color-white)',
                    color: 'var(--color-purple)',
                    transition: 'all 150ms',
                  }}
                >
                  + {enrollment.students.first_name} {enrollment.students.last_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {totalCostumes === 0 ? (
          <p
            style={{
              fontSize: 16,
              color: 'var(--color-ink-3)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            No costume entries yet.{' '}
            {event.enrollments.length > 0
              ? 'Use the buttons above to add costumes for enrolled students.'
              : 'Enroll students first, then add costume entries.'}
          </p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 0',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Student
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 8px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 8px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Size
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Ordered
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Received
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {event.costumes.map((costume: CostumeEntry) => (
                <tr
                  key={costume.id}
                  style={{ borderBottom: '1px solid var(--color-line)' }}
                >
                  <td style={{ padding: '12px 0', color: 'var(--color-ink)' }}>
                    {costume.students.first_name} {costume.students.last_name}
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'var(--color-ink-2)',
                    }}
                  >
                    {costume.description ?? '--'}
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      color: 'var(--color-ink-2)',
                    }}
                  >
                    {costume.size ?? '--'}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={costume.ordered}
                      onChange={() => handleCostumeToggle(costume, 'ordered')}
                      style={{
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        accentColor: 'var(--color-purple)',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={costume.received}
                      onChange={() => handleCostumeToggle(costume, 'received')}
                      style={{
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        accentColor: 'var(--color-purple)',
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={costume.paid}
                      onChange={() => handleCostumeToggle(costume, 'paid')}
                      style={{
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        accentColor: 'var(--color-purple)',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
