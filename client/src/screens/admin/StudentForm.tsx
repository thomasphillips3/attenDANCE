import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'
import { useStudent, useCreateStudent, useUpdateStudent } from '../../hooks/useStudents'
import { useFamilies } from '../../hooks/useFamilies'
import { useAuth } from '../../hooks/useAuth'
import PhotoUpload from '../../components/admin/PhotoUpload'

// Zod schema for student form validation
const studentSchema = z.object({
  first_name: z.string().min(1, 'First name required'),
  last_name: z.string().min(1, 'Last name required'),
  dob: z.string().optional(),
  medical_notes: z.string().optional(),
  skill_level: z.string().optional(),
  family_id: z.string().min(1, 'Please select a family'),
  photo_url: z.string().optional(),
})

type StudentFormData = z.infer<typeof studentSchema>

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * StudentForm — create/edit student with photo upload, family picker,
 * RFID card assignment, and deactivation.
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function StudentForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { session } = useAuth()
  const token = session?.access_token

  // Decode organizationId from JWT for photo upload path (T-02-08)
  let organizationId = ''
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      organizationId = payload.app_metadata?.organization_id ?? ''
    } catch {
      // Fallback — org ID will be empty, upload path won't include it
    }
  }

  // Data hooks
  const { data: student, isLoading: studentLoading } = useStudent(isEdit ? id : undefined)
  const { data: familiesResponse } = useFamilies()
  const families = familiesResponse?.data ?? []
  const createStudent = useCreateStudent()
  const updateStudent = useUpdateStudent(id ?? '')

  // RFID state
  const [rfidInput, setRfidInput] = useState('')
  const [rfidError, setRfidError] = useState<string | null>(null)
  const [rfidLoading, setRfidLoading] = useState(false)

  // Deactivation dialog
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Form error
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      dob: '',
      medical_notes: '',
      skill_level: '',
      family_id: '',
      photo_url: '',
    },
  })

  // Populate form when student data loads in edit mode
  useEffect(() => {
    if (student && isEdit) {
      reset({
        first_name: student.first_name ?? '',
        last_name: student.last_name ?? '',
        dob: student.dob ?? '',
        medical_notes: student.medical_notes ?? '',
        skill_level: student.skill_level ?? '',
        family_id: student.family_id ?? '',
        photo_url: student.photo_url ?? '',
      })
    }
  }, [student, isEdit, reset])

  // Show loading spinner in edit mode while student data loads
  if (isEdit && studentLoading) {
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

  const onSubmit = async (data: StudentFormData) => {
    setSubmitError(null)
    try {
      const payload = {
        firstName: data.first_name,
        lastName: data.last_name,
        familyId: data.family_id,
        dob: data.dob || undefined,
        medicalNotes: data.medical_notes || undefined,
        skillLevel: data.skill_level || undefined,
        photoUrl: data.photo_url || undefined,
      }

      if (isEdit) {
        await updateStudent.mutateAsync(payload)
      } else {
        await createStudent.mutateAsync(payload)
      }
      navigate('/admin/students')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save student')
    }
  }

  const handleDeactivate = async () => {
    if (!id) return
    setDeactivating(true)
    try {
      await updateStudent.mutateAsync({ active: false })
      setDeactivateOpen(false)
      navigate('/admin/students')
    } catch {
      setDeactivating(false)
    }
  }

  const handleAssignRfid = async () => {
    if (!rfidInput.trim() || !id) return
    setRfidError(null)
    setRfidLoading(true)

    try {
      const res = await fetch(`${API_URL}/rfid-cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId: id, cardUid: rfidInput.trim() }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to assign card' }))
        if (res.status === 409) {
          setRfidError('Card already assigned to another student')
        } else {
          setRfidError(err.error || 'Failed to assign card')
        }
        return
      }

      setRfidInput('')
      // Refetch student to get updated RFID cards
      window.location.reload()
    } catch {
      setRfidError('Failed to assign card')
    } finally {
      setRfidLoading(false)
    }
  }

  const handleRemoveRfid = async (cardId: string) => {
    try {
      await fetch(`${API_URL}/rfid-cards/${cardId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      window.location.reload()
    } catch {
      // Silent fail — user can retry
    }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    height: 48,
    padding: '12px 16px',
    border: '1px solid var(--color-line)',
    borderRadius: 'var(--radius-sm)',
    width: '100%',
    fontFamily: 'var(--font-body)',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-ink-2)',
    marginBottom: 4,
    display: 'block',
    fontFamily: 'var(--font-body)',
  }

  const errorStyle: React.CSSProperties = {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'var(--font-body)',
  }

  return (
    <div>
      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--color-ink)',
          margin: '0 0 24px 0',
        }}
      >
        {isEdit ? 'Edit Student' : 'Add Student'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Photo upload */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <PhotoUpload
            currentPhotoUrl={student?.signedPhotoUrl}
            studentId={id}
            organizationId={organizationId}
            onUpload={(path) => setValue('photo_url', path)}
          />
        </div>

        {/* First Name */}
        <div>
          <label style={labelStyle}>First Name</label>
          <input {...register('first_name')} style={inputStyle} />
          {errors.first_name && <p style={errorStyle}>{errors.first_name.message}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label style={labelStyle}>Last Name</label>
          <input {...register('last_name')} style={inputStyle} />
          {errors.last_name && <p style={errorStyle}>{errors.last_name.message}</p>}
        </div>

        {/* Date of Birth */}
        <div>
          <label style={labelStyle}>Date of Birth</label>
          <input type="date" {...register('dob')} style={inputStyle} />
        </div>

        {/* Medical Notes */}
        <div>
          <label style={labelStyle}>Medical Notes</label>
          <textarea
            {...register('medical_notes')}
            rows={3}
            style={{
              ...inputStyle,
              height: 'auto',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Skill Level */}
        <div>
          <label style={labelStyle}>Skill Level</label>
          <select {...register('skill_level')} style={inputStyle}>
            <option value="">--</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Pre-Professional">Pre-Professional</option>
          </select>
        </div>

        {/* Family Picker */}
        <div>
          <label style={labelStyle}>Family</label>
          {families.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--color-ink-3)', fontFamily: 'var(--font-body)' }}>
              No families yet.{' '}
              <Link
                to="/admin/families/new"
                style={{ color: 'var(--color-purple)', textDecoration: 'underline' }}
              >
                Create a family first
              </Link>
            </p>
          ) : (
            <select {...register('family_id')} style={inputStyle}>
              <option value="">Select a family...</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.primary_guardian_name}
                </option>
              ))}
            </select>
          )}
          {errors.family_id && <p style={errorStyle}>{errors.family_id.message}</p>}
        </div>

        {/* Hidden photo_url field */}
        <input type="hidden" {...register('photo_url')} />

        {/* Submit error */}
        {submitError && (
          <p style={{ ...errorStyle, fontSize: 14 }}>{submitError}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={createStudent.isPending || updateStudent.isPending}
            style={{
              background: 'var(--color-purple)',
              color: 'white',
              height: 48,
              minHeight: 56,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              minWidth: 160,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              opacity: (createStudent.isPending || updateStudent.isPending) ? 0.6 : 1,
            }}
          >
            {(createStudent.isPending || updateStudent.isPending) ? 'Saving...' : 'Save Student'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/students')}
            style={{
              background: 'white',
              color: 'var(--color-ink-2)',
              height: 48,
              minHeight: 56,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line-strong)',
              minWidth: 120,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Cancel
          </button>

          {isEdit && student?.active && (
            <button
              type="button"
              onClick={() => setDeactivateOpen(true)}
              style={{
                background: 'white',
                color: '#D32F2F',
                height: 48,
                minHeight: 56,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #D32F2F',
                minWidth: 160,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Deactivate Student
            </button>
          )}
        </div>
      </form>

      {/* RFID Card section — edit mode only */}
      {isEdit && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-line)', margin: '32px 0' }} />

          <div style={{ maxWidth: 600 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
              }}
            >
              RFID Card
            </h2>

            {/* Existing RFID cards */}
            {student?.rfidCards && student.rfidCards.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {student.rfidCards.map((card) => (
                  <div
                    key={card.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: '1px solid var(--color-line)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontFamily: 'monospace' }}>
                      {card.card_uid}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRfid(card.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#D32F2F',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Assign new RFID card */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="text"
                placeholder="Enter card UID"
                value={rfidInput}
                onChange={(e) => {
                  setRfidInput(e.target.value)
                  setRfidError(null)
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAssignRfid}
                disabled={rfidLoading || !rfidInput.trim()}
                style={{
                  height: 48,
                  minHeight: 56,
                  padding: '0 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  background: 'var(--color-purple)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: (rfidLoading || !rfidInput.trim()) ? 'default' : 'pointer',
                  opacity: (rfidLoading || !rfidInput.trim()) ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {rfidLoading ? 'Assigning...' : 'Assign Card'}
              </button>
            </div>
            {rfidError && <p style={{ ...errorStyle, marginTop: 8 }}>{rfidError}</p>}
          </div>
        </>
      )}

      {/* Deactivation confirmation dialog */}
      <Dialog open={deactivateOpen} onOpenChange={(open) => { if (!open) setDeactivateOpen(false) }}>
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
              borderRadius: 28,
              padding: 36,
              maxWidth: 480,
              width: 'calc(100vw - 48px)',
              outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: 'var(--color-ink)',
                margin: '0 0 16px 0',
              }}
            >
              Deactivate {student?.first_name} {student?.last_name}?
            </DialogTitle>
            <p style={{ fontSize: 16, color: 'var(--color-ink-2)', margin: '0 0 24px 0' }}>
              They will no longer appear in class rosters.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeactivateOpen(false)}
                style={{
                  flex: 1,
                  minHeight: 56,
                  border: '1px solid var(--color-line)',
                  background: 'white',
                  color: 'var(--color-ink-2)',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                style={{
                  flex: 1,
                  minHeight: 56,
                  background: '#D32F2F',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: deactivating ? 'not-allowed' : 'pointer',
                  opacity: deactivating ? 0.6 : 1,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
