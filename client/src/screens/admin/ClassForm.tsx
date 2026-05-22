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
import { useClass, useCreateClass, useUpdateClass } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import type { CreateClassPayload, UpdateClassPayload } from '../../hooks/useClasses'

// ---------------------------------------------------------------------------
// Zod v4 schema for the class form
// ---------------------------------------------------------------------------
const classFormSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  type: z.enum(['recurring', 'drop_in', 'workshop']),
  instructor_id: z.string().optional(),
  day_of_week: z.union([z.coerce.number().min(0).max(6), z.literal('')]).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  duration_minutes: z.coerce.number().min(15, 'Minimum 15 minutes').max(240, 'Maximum 4 hours'),
  room: z.string().optional(),
  capacity: z.union([z.coerce.number().min(1, 'Minimum capacity is 1'), z.literal('')]).optional(),
  age_min: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  age_max: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  level: z.string().optional(),
})

type ClassFormData = z.infer<typeof classFormSchema>

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 12px',
  fontSize: 16,
  fontFamily: 'var(--font-body)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-ink)',
  background: 'var(--color-white)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--color-ink-2)',
  marginBottom: 4,
  fontFamily: 'var(--font-body)',
}

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#dc2626',
  marginTop: 4,
  fontFamily: 'var(--font-body)',
}

// ---------------------------------------------------------------------------
// ClassForm component
// ---------------------------------------------------------------------------
export default function ClassForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: classData, isLoading: classLoading } = useClass(id)
  const { data: staffList } = useStaff()
  const createClass = useCreateClass()
  const updateClass = useUpdateClass(id ?? '')

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: '',
      type: 'recurring',
      instructor_id: '',
      day_of_week: '',
      start_time: '09:00',
      duration_minutes: 60,
      room: '',
      capacity: '',
      age_min: '',
      age_max: '',
      level: '',
    },
  })

  const classType = watch('type')

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (isEdit && classData) {
      reset({
        name: classData.name,
        type: classData.type,
        instructor_id: classData.instructor_id ?? '',
        day_of_week: classData.day_of_week !== null ? classData.day_of_week : '',
        start_time: classData.start_time,
        duration_minutes: classData.duration_minutes,
        room: classData.room ?? '',
        capacity: classData.capacity !== null ? classData.capacity : '',
        age_min: classData.age_min !== null ? classData.age_min : '',
        age_max: classData.age_max !== null ? classData.age_max : '',
        level: classData.level ?? '',
      })
    }
  }, [isEdit, classData, reset])

  const onSubmit = async (data: ClassFormData) => {
    setSubmitError(null)
    try {
      // Map form data to API body — convert empty strings to undefined
      const instructorId = data.instructor_id && data.instructor_id !== '' ? data.instructor_id : undefined
      const dayOfWeek = data.day_of_week !== '' && data.day_of_week !== undefined ? Number(data.day_of_week) : undefined
      const capacity = data.capacity !== '' && data.capacity !== undefined ? Number(data.capacity) : undefined
      const ageMin = data.age_min !== '' && data.age_min !== undefined ? Number(data.age_min) : undefined
      const ageMax = data.age_max !== '' && data.age_max !== undefined ? Number(data.age_max) : undefined
      const room = data.room && data.room !== '' ? data.room : undefined
      const level = data.level && data.level !== '' ? data.level : undefined

      // Validate: recurring classes require day_of_week
      if (data.type === 'recurring' && dayOfWeek === undefined) {
        setSubmitError('Day of week is required for recurring classes')
        return
      }

      if (isEdit) {
        const body: UpdateClassPayload = {
          name: data.name,
          type: data.type,
          instructorId,
          dayOfWeek,
          startTime: data.start_time,
          durationMinutes: data.duration_minutes,
          room,
          capacity,
          ageMin,
          ageMax,
          level,
        }
        await updateClass.mutateAsync(body)
      } else {
        const body: CreateClassPayload = {
          name: data.name,
          type: data.type,
          instructorId,
          dayOfWeek,
          startTime: data.start_time,
          durationMinutes: data.duration_minutes,
          room,
          capacity,
          ageMin,
          ageMax,
          level,
        }
        await createClass.mutateAsync(body)
      }
      navigate('/admin/classes')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save class')
    }
  }

  const handleDeactivate = async () => {
    if (!id) return
    setIsDeactivating(true)
    try {
      await updateClass.mutateAsync({ active: false })
      navigate('/admin/classes')
    } catch {
      setIsDeactivating(false)
    }
  }

  // Show spinner while loading class data in edit mode
  if (isEdit && classLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 48,
          fontFamily: 'var(--font-body)',
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
    )
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Back link */}
      <Link
        to="/admin/classes"
        style={{
          fontSize: 14,
          color: 'var(--color-purple)',
          textDecoration: 'none',
          fontFamily: 'var(--font-body)',
        }}
      >
        &larr; Back to Classes
      </Link>

      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--color-ink)',
          margin: '12px 0 24px 0',
        }}
      >
        {isEdit ? 'Edit Class' : 'Add Class'}
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Class Name */}
        <div>
          <label style={labelStyle}>
            Class Name *
            <input {...register('name')} style={inputStyle} placeholder="e.g. Ballet I" />
          </label>
          {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
        </div>

        {/* Type */}
        <div>
          <label style={labelStyle}>
            Type
            <select {...register('type')} style={inputStyle}>
              <option value="recurring">Recurring</option>
              <option value="drop_in">Drop-in</option>
              <option value="workshop">Workshop</option>
            </select>
          </label>
        </div>

        {/* Instructor */}
        <div>
          <label style={labelStyle}>
            Instructor
            <select {...register('instructor_id')} style={inputStyle}>
              <option value="">No instructor</option>
              {(staffList ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Day of Week — required for recurring, optional otherwise */}
        {classType === 'recurring' ? (
          <div>
            <label style={labelStyle}>
              Day of Week *
              <select {...register('day_of_week')} style={inputStyle}>
                <option value="">Select a day</option>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </label>
            {errors.day_of_week && <div style={errorStyle}>{errors.day_of_week.message}</div>}
          </div>
        ) : (
          <div>
            <label style={labelStyle}>
              Day of Week (optional)
              <select {...register('day_of_week')} style={inputStyle}>
                <option value="">No fixed day</option>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </label>
          </div>
        )}

        {/* Start Time */}
        <div>
          <label style={labelStyle}>
            Start Time *
            <input type="time" {...register('start_time')} style={inputStyle} />
          </label>
          {errors.start_time && <div style={errorStyle}>{errors.start_time.message}</div>}
        </div>

        {/* Duration */}
        <div>
          <label style={labelStyle}>
            Duration
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                {...register('duration_minutes')}
                style={{ ...inputStyle, width: 120 }}
                min={15}
                max={240}
              />
              <span style={{ fontSize: 14, color: 'var(--color-ink-2)' }}>minutes</span>
            </div>
          </label>
          {errors.duration_minutes && <div style={errorStyle}>{errors.duration_minutes.message}</div>}
        </div>

        {/* Room */}
        <div>
          <label style={labelStyle}>
            Room
            <input {...register('room')} style={inputStyle} placeholder="e.g. Studio A" />
          </label>
        </div>

        {/* Capacity */}
        <div>
          <label style={labelStyle}>
            Capacity
            <input
              type="number"
              {...register('capacity')}
              style={inputStyle}
              placeholder="No limit"
              min={1}
            />
          </label>
          {errors.capacity && <div style={errorStyle}>{errors.capacity.message}</div>}
        </div>

        {/* Age Range */}
        <div>
          <label style={{ ...labelStyle, marginBottom: 8 }}>Age Range</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                {...register('age_min')}
                style={inputStyle}
                placeholder="Min Age"
                min={0}
              />
            </div>
            <span style={{ fontSize: 14, color: 'var(--color-ink-2)' }}>to</span>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                {...register('age_max')}
                style={inputStyle}
                placeholder="Max Age"
                min={0}
              />
            </div>
          </div>
          {(errors.age_min || errors.age_max) && (
            <div style={errorStyle}>
              {errors.age_min?.message || errors.age_max?.message}
            </div>
          )}
        </div>

        {/* Level */}
        <div>
          <label style={labelStyle}>
            Level
            <select {...register('level')} style={inputStyle}>
              <option value="">--</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Pre-Professional">Pre-Professional</option>
              <option value="Open">Open</option>
            </select>
          </label>
        </div>

        {/* Submit error */}
        {submitError && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              color: '#dc2626',
              fontSize: 14,
            }}
          >
            {submitError}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: 48,
              minWidth: 160,
              background: 'var(--color-purple)',
              color: 'var(--color-white)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save Class'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/classes')}
            style={{
              height: 48,
              minWidth: 100,
              background: 'var(--color-white)',
              color: 'var(--color-ink-2)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          {isEdit && (
            <button
              type="button"
              onClick={() => setDeactivateOpen(true)}
              style={{
                height: 48,
                minWidth: 160,
                background: 'var(--color-white)',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Deactivate Class
            </button>
          )}
        </div>
      </form>

      {/* Deactivation confirmation dialog */}
      {isEdit && (
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
                borderRadius: 20,
                padding: 32,
                maxWidth: 440,
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
                  margin: '0 0 12px 0',
                }}
              >
                Deactivate {classData?.name}?
              </DialogTitle>
              <p
                style={{
                  fontSize: 16,
                  color: 'var(--color-ink-2)',
                  lineHeight: 1.5,
                  margin: '0 0 24px 0',
                }}
              >
                Enrolled students will remain in the roster but no new enrollments will be accepted.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setDeactivateOpen(false)}
                  style={{
                    flex: 1,
                    height: 48,
                    background: 'var(--color-white)',
                    color: 'var(--color-ink-2)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 16,
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                  style={{
                    flex: 1,
                    height: 48,
                    background: '#dc2626',
                    color: 'var(--color-white)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    cursor: isDeactivating ? 'not-allowed' : 'pointer',
                    opacity: isDeactivating ? 0.7 : 1,
                  }}
                >
                  {isDeactivating ? 'Deactivating...' : 'Deactivate'}
                </button>
              </div>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  )
}
