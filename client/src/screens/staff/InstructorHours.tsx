import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'

/**
 * InstructorHours -- hour logging form + history table with pay calculation.
 *
 * Top: form to log hours (date, hours, optional class, notes).
 * Middle: history table from GET /staff/me/hours.
 * Bottom: total hours and calculated pay (hours * hourly_rate).
 *
 * Default export required for React.lazy in router.tsx.
 */

interface HourEntry {
  id: string
  date: string
  hours: number
  notes: string | null
  class_id: string | null
  classes: { name: string } | null
  created_at: string
}

interface HoursResponse {
  data: HourEntry[]
  total_hours: number
  hourly_rate: number
  total_pay: number
}

interface ClassOption {
  id: string
  name: string
}

export default function InstructorHours() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  // Form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [classId, setClassId] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  // Fetch hours history
  const { data: hoursData, isLoading } = useQuery<HoursResponse>({
    queryKey: ['staff', 'hours'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/staff/me/hours`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to fetch hours: ${res.status}`)
      return res.json()
    },
    enabled: !!token,
  })

  // Fetch schedule for class dropdown
  const { data: scheduleData } = useQuery<{ data: ClassOption[] }>({
    queryKey: ['staff', 'schedule'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/staff/me/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to fetch schedule: ${res.status}`)
      return res.json()
    },
    enabled: !!token,
  })

  // Submit hours mutation
  const logHours = useMutation({
    mutationFn: async (body: { date: string; hours: number; class_id?: string; notes?: string }) => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/staff/hours`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to log hours' }))
        throw new Error(err.error || 'Failed to log hours')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'hours'] })
      setHours('')
      setClassId('')
      setNotes('')
      setFormError('')
      setFormSuccess('Hours logged successfully')
      setTimeout(() => setFormSuccess(''), 3000)
    },
    onError: (err: Error) => {
      setFormError(err.message)
      setFormSuccess('')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    const numHours = parseFloat(hours)
    if (!date) {
      setFormError('Date is required')
      return
    }
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      setFormError('Hours must be between 0 and 24')
      return
    }

    logHours.mutate({
      date,
      hours: numHours,
      class_id: classId || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const entries = hoursData?.data ?? []
  const classes = scheduleData?.data ?? []

  // Input and label shared styles
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16,
    fontFamily: 'var(--font-body)',
    border: '1px solid var(--color-line)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-white)',
    color: 'var(--color-ink)',
    boxSizing: 'border-box',
    minHeight: 48,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-ink-2)',
    fontFamily: 'var(--font-body)',
    marginBottom: 4,
    display: 'block',
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
        Log Hours
      </h1>

      {/* Log hours form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          padding: 20,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* Date */}
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {/* Hours */}
          <div>
            <label style={labelStyle}>Hours</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 2.5"
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* Class (optional) */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Class (optional)</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={inputStyle}
          >
            <option value="">-- No specific class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Extra rehearsal time, recital prep..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Error / success messages */}
        {formError && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              color: '#dc2626',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {formError}
          </div>
        )}
        {formSuccess && (
          <div
            style={{
              padding: '10px 14px',
              background: '#f0fdf4',
              color: '#16a34a',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {formSuccess}
          </div>
        )}

        <button
          type="submit"
          disabled={logHours.isPending}
          style={{
            background: 'var(--color-purple)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 28px',
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: logHours.isPending ? 'not-allowed' : 'pointer',
            opacity: logHours.isPending ? 0.6 : 1,
            minHeight: 56,
          }}
        >
          {logHours.isPending ? 'Logging...' : 'Log Hours'}
        </button>
      </form>

      {/* Hours history */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 16,
        }}
      >
        Hours History
      </h2>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
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

      {!isLoading && entries.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
            fontFamily: 'var(--font-body)',
          }}
        >
          No hours logged yet
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          {/* Table */}
          <div
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--color-paper)',
                    borderBottom: '1px solid var(--color-line)',
                  }}
                >
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-ink-2)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-ink-2)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-ink-2)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Class</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--color-ink-2)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const d = new Date(entry.date + 'T00:00:00')
                  const formatted = d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: '1px solid var(--color-line)' }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink)' }}>
                        {formatted}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--color-purple)',
                        }}
                      >
                        {Number(entry.hours).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-ink-2)' }}>
                        {entry.classes?.name ?? '\u2014'}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--color-ink-3)',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.notes ?? '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div
            style={{
              background: 'var(--color-purple-tint)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--color-purple)',
                }}
              >
                {hoursData?.total_hours.toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Total hours
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--color-purple)',
                }}
              >
                ${hoursData?.hourly_rate.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Hourly rate
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--color-green-deep)',
                }}
              >
                ${hoursData?.total_pay.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
                Total pay
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
