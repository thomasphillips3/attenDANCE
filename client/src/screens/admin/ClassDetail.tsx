import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useClass, useClasses } from '../../hooks/useClasses'
import type { EnrollmentRecord } from '../../hooks/useClasses'
import { useDropStudent, useTransferStudent } from '../../hooks/useEnrollments'
import EnrollmentModal from '../../components/admin/EnrollmentModal'

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
 * Format ISO date string as "May 22, 2026"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * ClassDetail -- full class detail page with enrollment management.
 *
 * Shows class info, capacity bar, enrolled students list with drop/transfer actions,
 * waitlist section in gold, and EnrollmentModal for adding students.
 * All operations use the enrollment API endpoints (Plan 02-04) which call
 * Postgres functions for capacity enforcement and atomic transfers.
 */
export default function ClassDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: classData, isLoading } = useClass(id)
  const { data: allClasses } = useClasses()
  const dropMutation = useDropStudent()
  const transferMutation = useTransferStudent()

  // UI state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false)
  const [dropDialogOpen, setDropDialogOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState<{
    enrollmentId: string
    studentName: string
  } | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferStudentId, setTransferStudentId] = useState<string | null>(null)
  const [transferStudentName, setTransferStudentName] = useState('')
  const [selectedTransferClassId, setSelectedTransferClassId] = useState<string | null>(null)
  const [transferResult, setTransferResult] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--color-line)',
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

  if (!classData) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 18,
          color: 'var(--color-ink-2)',
          padding: 24,
        }}
      >
        Class not found.{' '}
        <Link
          to="/admin/classes"
          style={{ color: 'var(--color-purple)', textDecoration: 'none' }}
        >
          Back to Classes
        </Link>
      </div>
    )
  }

  const {
    name,
    day_of_week,
    start_time,
    duration_minutes,
    staff,
    room,
    type,
    level,
    age_min,
    age_max,
    capacity,
    enrolledCount,
    waitlistCount,
    activeEnrollments,
    waitlistEnrollments,
  } = classData

  const isFull = capacity !== null && enrolledCount >= capacity
  const fillPercent = capacity !== null && capacity > 0
    ? Math.min(100, (enrolledCount / capacity) * 100)
    : 0

  // Schedule string
  const dayName = day_of_week !== null ? FULL_DAYS[day_of_week] : 'TBD'
  const schedule = start_time
    ? `${dayName}, ${formatTime(start_time)} - ${formatEndTime(start_time, duration_minutes)}`
    : dayName

  // Instructor name
  const instructorName = staff
    ? `${staff.first_name} ${staff.last_name}`
    : 'None assigned'

  // Age range
  const ageRange = age_min !== null && age_max !== null
    ? `${age_min} - ${age_max}`
    : age_min !== null
      ? `${age_min}+`
      : 'All ages'

  // Other classes for transfer (exclude current class)
  const otherClasses = (allClasses ?? []).filter((c) => c.id !== id)

  // Drop handlers
  const openDropDialog = (enrollment: EnrollmentRecord) => {
    setDropTarget({
      enrollmentId: enrollment.id,
      studentName: `${enrollment.students.first_name} ${enrollment.students.last_name}`,
    })
    setDropDialogOpen(true)
  }

  const handleDrop = async () => {
    if (!dropTarget) return
    try {
      await dropMutation.mutateAsync(dropTarget.enrollmentId)
      setDropDialogOpen(false)
      setDropTarget(null)
    } catch {
      // Error is shown via mutation state
    }
  }

  // Transfer handlers
  const openTransferDialog = (enrollment: EnrollmentRecord) => {
    setTransferStudentId(enrollment.student_id)
    setTransferStudentName(
      `${enrollment.students.first_name} ${enrollment.students.last_name}`
    )
    setSelectedTransferClassId(null)
    setTransferResult(null)
    setTransferError(null)
    setTransferDialogOpen(true)
  }

  const handleTransfer = async () => {
    if (!transferStudentId || !selectedTransferClassId || !id) return
    setTransferError(null)
    try {
      const result = await transferMutation.mutateAsync({
        studentId: transferStudentId,
        fromClassId: id,
        toClassId: selectedTransferClassId,
      })
      const statusText = result.toStatus === 'active' ? 'enrolled' : 'waitlisted'
      setTransferResult(`Student ${statusText} in new class`)
      setTimeout(() => {
        setTransferDialogOpen(false)
        setTransferResult(null)
      }, 2000)
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : 'Transfer failed'
      )
    }
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', maxWidth: 800 }}>
      {/* Back link */}
      <Link
        to="/admin/classes"
        style={{
          fontSize: 14,
          color: 'var(--color-purple)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 12,
        }}
      >
        &lt; Back to Classes
      </Link>

      {/* Header: class name + edit link */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--color-ink)',
            margin: 0,
            fontWeight: 400,
          }}
        >
          {name}
        </h1>
        <Link
          to={`/admin/classes/${id}/edit`}
          style={{
            fontSize: 14,
            color: 'var(--color-purple)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Edit Class
        </Link>
      </div>

      {/* Metadata grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 24px',
          marginTop: 16,
          fontSize: 14,
        }}
      >
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Schedule</span>
          <div style={{ color: 'var(--color-ink)' }}>{schedule}</div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Instructor</span>
          <div style={{ color: 'var(--color-ink)' }}>{instructorName}</div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Room</span>
          <div style={{ color: 'var(--color-ink)' }}>{room || 'Not specified'}</div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Type</span>
          <div style={{ color: 'var(--color-ink)', textTransform: 'capitalize' }}>
            {type?.replace('_', ' ') || 'Recurring'}
          </div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Level</span>
          <div style={{ color: 'var(--color-ink)', textTransform: 'capitalize' }}>
            {level || 'All levels'}
          </div>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-ink-2)' }}>Age Range</span>
          <div style={{ color: 'var(--color-ink)' }}>{ageRange}</div>
        </div>
      </div>

      {/* Capacity section */}
      <div style={{ marginTop: 24 }}>
        {capacity !== null ? (
          <>
            <div
              style={{
                height: 10,
                borderRadius: 5,
                background: 'var(--color-line)',
                width: '100%',
                maxWidth: 400,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${fillPercent}%`,
                  height: '100%',
                  background: isFull ? 'var(--color-gold-ink)' : 'var(--color-purple)',
                  borderRadius: 5,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            <p
              style={{
                fontSize: 16,
                color: 'var(--color-ink)',
                margin: '6px 0 0 0',
              }}
            >
              {enrolledCount} of {capacity} enrolled
              {waitlistCount > 0 && (
                <span style={{ color: 'var(--color-gold-ink)' }}>
                  {' '}+ {waitlistCount} on waitlist
                </span>
              )}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 16, color: 'var(--color-ink)', margin: 0 }}>
            {enrolledCount} enrolled (open enrollment)
          </p>
        )}

        <button
          type="button"
          onClick={() => setEnrollModalOpen(true)}
          style={{
            background: 'var(--color-purple)',
            color: 'white',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            height: 48,
            padding: '0 24px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            marginTop: 12,
          }}
        >
          Enroll Student
        </button>
      </div>

      {/* Enrolled Students section */}
      <div style={{ marginTop: 32 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-ink)',
            margin: '0 0 12px 0',
            fontFamily: 'var(--font-body)',
          }}
        >
          Enrolled Students ({enrolledCount})
        </h2>

        {activeEnrollments.length === 0 ? (
          <p
            style={{
              fontSize: 16,
              fontStyle: 'italic',
              color: 'var(--color-ink-3)',
              margin: 0,
            }}
          >
            No students enrolled yet
          </p>
        ) : (
          activeEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-line)',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* Student info */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <Link
                  to={`/admin/students/${enrollment.student_id}`}
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: 'var(--color-purple)',
                    textDecoration: 'none',
                  }}
                >
                  {enrollment.students.first_name} {enrollment.students.last_name}
                </Link>
              </div>

              {/* Enrolled date */}
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-ink-3)',
                  minWidth: 100,
                }}
              >
                {formatDate(enrollment.enrolled_at)}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openTransferDialog(enrollment)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-purple)',
                    color: 'var(--color-purple)',
                    fontSize: 13,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() => openDropDialog(enrollment)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #D32F2F',
                    color: '#D32F2F',
                    fontSize: 13,
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Drop
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Waitlist section */}
      {waitlistEnrollments.length > 0 && (
        <div
          style={{
            background: 'var(--color-gold-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginTop: 24,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--color-gold-ink)',
              margin: '0 0 4px 0',
              fontFamily: 'var(--font-body)',
            }}
          >
            Waitlist ({waitlistCount})
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-gold-ink)',
              margin: '0 0 12px 0',
            }}
          >
            Students are auto-promoted when a spot opens, in order of enrollment date.
          </p>

          {waitlistEnrollments.map((enrollment, index) => (
            <div
              key={enrollment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom:
                  index < waitlistEnrollments.length - 1
                    ? '1px solid rgba(139, 105, 20, 0.15)'
                    : 'none',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {/* Position number */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-gold-ink)',
                  minWidth: 24,
                }}
              >
                {index + 1}.
              </span>

              {/* Student name */}
              <Link
                to={`/admin/students/${enrollment.student_id}`}
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--color-gold-ink)',
                  textDecoration: 'none',
                  flex: 1,
                  minWidth: 120,
                }}
              >
                {enrollment.students.first_name} {enrollment.students.last_name}
              </Link>

              {/* Enrolled date */}
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--color-gold-ink)',
                  opacity: 0.7,
                  minWidth: 100,
                }}
              >
                {formatDate(enrollment.enrolled_at)}
              </span>

              {/* Remove from waitlist */}
              <button
                type="button"
                onClick={() => openDropDialog(enrollment)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-gold-ink)',
                  color: 'var(--color-gold-ink)',
                  fontSize: 13,
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Remove from Waitlist
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop confirmation dialog */}
      <Dialog
        open={dropDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDropDialogOpen(false)
            setDropTarget(null)
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.40)',
              zIndex: 50,
            }}
          />
          <DialogContent
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              background: 'var(--color-white)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
              padding: 28,
              maxWidth: 440,
              width: 'calc(100vw - 48px)',
              outline: 'none',
            }}
          >
            <DialogTitle
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 12px 0',
              }}
            >
              Drop Student
            </DialogTitle>
            <p
              style={{
                fontSize: 16,
                color: 'var(--color-ink-2)',
                margin: '0 0 24px 0',
                lineHeight: 1.5,
              }}
            >
              Remove {dropTarget?.studentName} from {name}? If there are students on the
              waitlist, the next one will be automatically enrolled.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setDropDialogOpen(false)
                  setDropTarget(null)
                }}
                style={{
                  height: 48,
                  padding: '0 20px',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  background: 'white',
                  color: 'var(--color-ink-2)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDrop}
                disabled={dropMutation.isPending}
                style={{
                  height: 48,
                  padding: '0 20px',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  background: '#D32F2F',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: dropMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: dropMutation.isPending ? 0.7 : 1,
                }}
              >
                {dropMutation.isPending ? 'Dropping...' : 'Drop Student'}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog
        open={transferDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setTransferDialogOpen(false)
            setTransferStudentId(null)
            setTransferResult(null)
            setTransferError(null)
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.40)',
              zIndex: 50,
            }}
          />
          <DialogContent
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 51,
              background: 'var(--color-white)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
              padding: 28,
              maxWidth: 520,
              width: 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
              outline: 'none',
            }}
          >
            <DialogTitle
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 12px 0',
              }}
            >
              Transfer {transferStudentName}
            </DialogTitle>
            <p
              style={{
                fontSize: 14,
                color: 'var(--color-ink-2)',
                margin: '0 0 16px 0',
              }}
            >
              Select target class:
            </p>

            {/* Class list for transfer */}
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                marginBottom: 16,
              }}
            >
              {otherClasses.length === 0 ? (
                <p
                  style={{
                    fontSize: 14,
                    color: 'var(--color-ink-3)',
                    fontStyle: 'italic',
                  }}
                >
                  No other classes available
                </p>
              ) : (
                otherClasses.map((cls) => {
                  const isSelected = selectedTransferClassId === cls.id
                  const targetFull =
                    cls.capacity !== null && cls.enrolledCount >= cls.capacity
                  const dayStr =
                    cls.day_of_week !== null ? FULL_DAYS[cls.day_of_week] : 'TBD'
                  const scheduleStr = cls.start_time
                    ? `${dayStr}, ${formatTime(cls.start_time)}`
                    : dayStr

                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedTransferClassId(cls.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left' as const,
                        padding: '12px 16px',
                        minHeight: 56,
                        display: 'block',
                        background: isSelected
                          ? 'var(--color-purple-tint)'
                          : 'transparent',
                        border: isSelected
                          ? '2px solid var(--color-purple)'
                          : '1px solid var(--color-line)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        marginBottom: 8,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 500,
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
                        }}
                      >
                        {scheduleStr}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: targetFull
                            ? 'var(--color-gold-ink)'
                            : 'var(--color-ink-3)',
                          marginTop: 2,
                        }}
                      >
                        {cls.enrolledCount}
                        {cls.capacity !== null ? ` / ${cls.capacity}` : ''} enrolled
                        {targetFull && ' (full -- will be waitlisted)'}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Transfer result/error */}
            {transferResult && (
              <div
                style={{
                  background: 'var(--color-purple-tint)',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  color: 'var(--color-purple)',
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                {transferResult}
              </div>
            )}
            {transferError && (
              <div
                style={{
                  background: '#FFEBEE',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 14,
                  color: '#D32F2F',
                  marginBottom: 12,
                }}
              >
                {transferError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setTransferDialogOpen(false)
                  setTransferStudentId(null)
                  setTransferResult(null)
                  setTransferError(null)
                }}
                style={{
                  height: 48,
                  padding: '0 20px',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  background: 'white',
                  color: 'var(--color-ink-2)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={
                  !selectedTransferClassId ||
                  transferMutation.isPending ||
                  !!transferResult
                }
                style={{
                  height: 48,
                  padding: '0 20px',
                  fontSize: 16,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  background: 'var(--color-purple)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor:
                    !selectedTransferClassId ||
                    transferMutation.isPending ||
                    !!transferResult
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    !selectedTransferClassId ||
                    transferMutation.isPending ||
                    !!transferResult
                      ? 0.5
                      : 1,
                }}
              >
                {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Enrollment modal */}
      <EnrollmentModal
        open={enrollModalOpen}
        onOpenChange={setEnrollModalOpen}
        classId={id!}
        className={name}
        enrolledCount={enrolledCount}
        capacity={capacity}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
