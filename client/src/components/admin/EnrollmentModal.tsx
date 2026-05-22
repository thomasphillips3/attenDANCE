import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useStudents } from '../../hooks/useStudents'
import { useEnrollStudent } from '../../hooks/useEnrollments'
import type { EnrollResponse } from '../../hooks/useEnrollments'

interface EnrollmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  className: string
  enrolledCount: number
  capacity: number | null
}

/**
 * EnrollmentModal -- search for a student and enroll them in a class.
 *
 * Shows capacity indicator with progress bar, gold warning when class is full
 * (student will be waitlisted). Uses Radix Dialog for accessibility (focus trap,
 * escape to close, ARIA roles). 300ms debounced search with useStudents hook.
 */
export default function EnrollmentModal({
  open,
  onOpenChange,
  classId,
  className,
  enrolledCount,
  capacity,
}: EnrollmentModalProps) {
  const [localSearch, setLocalSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [enrollResult, setEnrollResult] = useState<{
    studentId: string
    status: 'active' | 'waitlist'
  } | null>(null)
  const [enrollError, setEnrollError] = useState<{
    studentId: string
    message: string
  } | null>(null)

  const enrollMutation = useEnrollStudent()

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch])

  // Only query when 2+ characters
  const shouldSearch = debouncedSearch.length >= 2
  const { data: studentsResult } = useStudents({
    search: shouldSearch ? debouncedSearch : undefined,
    active: true,
    page: 1,
  })
  const students = shouldSearch ? (studentsResult?.data ?? []) : []

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setLocalSearch('')
      setDebouncedSearch('')
      setEnrollingId(null)
      setEnrollResult(null)
      setEnrollError(null)
    }
  }, [open])

  const isFull = capacity !== null && enrolledCount >= capacity
  const fillPercent = capacity !== null && capacity > 0
    ? Math.min(100, (enrolledCount / capacity) * 100)
    : 0

  const handleEnroll = async (studentId: string) => {
    setEnrollingId(studentId)
    setEnrollResult(null)
    setEnrollError(null)

    try {
      const result: EnrollResponse = await enrollMutation.mutateAsync({
        studentId,
        classId,
      })
      setEnrollResult({ studentId, status: result.status })
      setEnrollingId(null)

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setEnrollingId(null)
      setEnrollError({
        studentId,
        message: err instanceof Error ? err.message : 'Failed to enroll student',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Title */}
          <DialogTitle
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '0 0 16px 0',
            }}
          >
            Enroll Student in {className}
          </DialogTitle>

          {/* Capacity indicator */}
          {capacity !== null ? (
            <div style={{ marginBottom: 16 }}>
              {/* Progress bar */}
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'var(--color-line)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${fillPercent}%`,
                    height: '100%',
                    background: isFull ? 'var(--color-gold-ink)' : 'var(--color-purple)',
                    borderRadius: 4,
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  margin: '6px 0 0 0',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {enrolledCount} of {capacity} spots filled
              </p>

              {/* Full class warning */}
              {isFull && (
                <div
                  style={{
                    background: 'var(--color-gold-soft)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 12,
                    marginTop: 8,
                    color: 'var(--color-gold-ink)',
                    fontSize: 14,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Class is full -- student will be placed on the waitlist
                </div>
              )}
            </div>
          ) : (
            <p
              style={{
                fontSize: 14,
                color: 'var(--color-ink-3)',
                margin: '0 0 16px 0',
                fontFamily: 'var(--font-body)',
              }}
            >
              Open enrollment (no capacity limit)
            </p>
          )}

          {/* Search input */}
          <input
            type="search"
            placeholder="Search students by name..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{
              fontSize: 16,
              height: 48,
              padding: '12px 16px',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-sm)',
              width: '100%',
              fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />

          {/* Results list */}
          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              marginTop: 8,
            }}
          >
            {!shouldSearch ? (
              <p
                style={{
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-body)',
                  padding: '12px 0',
                }}
              >
                Type a name to search
              </p>
            ) : students.length === 0 ? (
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink-3)',
                  fontFamily: 'var(--font-body)',
                  padding: '12px 0',
                }}
              >
                No students found
              </p>
            ) : (
              students.map((student) => {
                const isEnrolling = enrollingId === student.id
                const isEnrolled = enrollResult?.studentId === student.id
                const hasError = enrollError?.studentId === student.id

                return (
                  <div key={student.id}>
                    <button
                      type="button"
                      onClick={() => handleEnroll(student.id)}
                      disabled={isEnrolling || enrollingId !== null || isEnrolled}
                      style={{
                        width: '100%',
                        textAlign: 'left' as const,
                        padding: '12px 16px',
                        minHeight: 56,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: isEnrolling || enrollingId !== null || isEnrolled
                          ? 'not-allowed'
                          : 'pointer',
                        background: isEnrolled
                          ? 'var(--color-purple-tint)'
                          : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--color-line)',
                        fontFamily: 'var(--font-body)',
                        opacity: enrollingId !== null && !isEnrolling ? 0.5 : 1,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 500,
                            color: 'var(--color-ink)',
                          }}
                        >
                          {student.first_name} {student.last_name}
                        </div>
                        {student.families?.primary_guardian_name && (
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--color-ink-3)',
                              marginTop: 2,
                            }}
                          >
                            {student.families.primary_guardian_name}
                          </div>
                        )}
                      </div>

                      {/* Status indicators */}
                      {isEnrolling && (
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            border: '2px solid var(--color-line)',
                            borderTopColor: 'var(--color-purple)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 0.7s linear infinite',
                          }}
                        />
                      )}
                      {isEnrolled && enrollResult.status === 'active' && (
                        <span
                          style={{
                            color: '#2E7D32',
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Enrolled!
                        </span>
                      )}
                      {isEnrolled && enrollResult.status === 'waitlist' && (
                        <span
                          style={{
                            color: 'var(--color-gold-ink)',
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          Added to waitlist
                        </span>
                      )}
                    </button>

                    {/* Error message */}
                    {hasError && (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#D32F2F',
                          padding: '4px 16px 8px',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {enrollError.message}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Cancel button */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={{
                height: 48,
                minHeight: 48,
                padding: '0 24px',
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                background: 'white',
                color: 'var(--color-ink-2)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
