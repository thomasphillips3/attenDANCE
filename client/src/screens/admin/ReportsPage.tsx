import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'

// ── Types ────────────────────────────────────────────────────────────

type ReportTab = 'enrollment' | 'revenue' | 'attendance'

interface EnrollmentRow {
  class_name: string
  active: number
  waitlist: number
  dropped: number
}

interface EnrollmentReport {
  summary: {
    total_active: number
    new_enrollments: number
    drops: number
  }
  rows: EnrollmentRow[]
}

interface RevenueRow {
  month: string
  collected: number
  invoiced: number
}

interface RevenueReport {
  summary: {
    total_collected: number
    outstanding: number
    overdue: number
    by_method: {
      stripe: number
      cash: number
      check: number
    }
  }
  monthly_trend: RevenueRow[]
  rows: RevenueRow[]
}

interface AttendanceRow {
  class_name: string
  total_records: number
  present: number
  absent: number
  late: number
  excused: number
  rate: number
}

interface AttendanceReport {
  summary: {
    overall_rate: number
    total_records: number
    present: number
    absent: number
    late: number
    excused: number
  }
  rows: AttendanceRow[]
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Format a number as USD currency. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Convert an array of objects to a CSV string with a header row. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          const str = String(val ?? '')
          // Quote fields that contain commas or quotes
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    ),
  ]
  return lines.join('\n')
}

/** Trigger a browser download from a CSV string. */
function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Get the first and last day of the current month as YYYY-MM-DD strings. */
function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

// ── Tab configuration ────────────────────────────────────────────────

const TABS: { label: string; value: ReportTab }[] = [
  { label: 'Enrollment', value: 'enrollment' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Attendance', value: 'attendance' },
]

// ── Component ────────────────────────────────────────────────────────

/**
 * ReportsPage -- admin reports with enrollment, revenue, and attendance tabs.
 *
 * Each tab queries its own report endpoint with a date range picker.
 * Summary cards display key metrics; a data table shows the breakdown.
 * "Export CSV" triggers a browser download of the rows array.
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function ReportsPage() {
  const { session } = useAuth()
  const token = session?.access_token

  const defaults = currentMonthRange()
  const [tab, setTab] = useState<ReportTab>('enrollment')
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)

  const apiUrl = import.meta.env.VITE_API_URL as string

  // ── Enrollment query ───────────────────────────────────────────────
  const enrollment = useQuery<EnrollmentReport>({
    queryKey: ['reports', 'enrollment', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl}/reports/enrollment?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res.json()
    },
    enabled: !!token && tab === 'enrollment',
  })

  // ── Revenue query ──────────────────────────────────────────────────
  const revenue = useQuery<RevenueReport>({
    queryKey: ['reports', 'revenue', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl}/reports/revenue?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res.json()
    },
    enabled: !!token && tab === 'revenue',
  })

  // ── Attendance query ───────────────────────────────────────────────
  const attendance = useQuery<AttendanceReport>({
    queryKey: ['reports', 'attendance', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl}/reports/attendance?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res.json()
    },
    enabled: !!token && tab === 'attendance',
  })

  // ── CSV export handler ─────────────────────────────────────────────
  function handleExport() {
    let rows: Record<string, any>[] = []
    let filename = 'report.csv'

    if (tab === 'enrollment' && enrollment.data) {
      rows = enrollment.data.rows
      filename = `enrollment-report-${startDate}-to-${endDate}.csv`
    } else if (tab === 'revenue' && revenue.data) {
      rows = revenue.data.rows
      filename = `revenue-report-${startDate}-to-${endDate}.csv`
    } else if (tab === 'attendance' && attendance.data) {
      rows = attendance.data.rows
      filename = `attendance-report-${startDate}-to-${endDate}.csv`
    }

    if (rows.length > 0) {
      downloadCsv(toCsv(rows), filename)
    }
  }

  const isLoading =
    (tab === 'enrollment' && enrollment.isLoading) ||
    (tab === 'revenue' && revenue.isLoading) ||
    (tab === 'attendance' && attendance.isLoading)

  const hasData =
    (tab === 'enrollment' && !!enrollment.data) ||
    (tab === 'revenue' && !!revenue.data) ||
    (tab === 'attendance' && !!attendance.data)

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-ink-3)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-body)',
            }}
          >
            Admin
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              color: 'var(--color-ink)',
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            Reports
          </div>
        </div>

        {/* Export CSV button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={!hasData}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 14,
            color: 'white',
            background: hasData ? 'var(--color-purple)' : 'var(--color-ink-3)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 20px',
            cursor: hasData ? 'pointer' : 'not-allowed',
            minHeight: 44,
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--color-line)',
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: tab === t.value ? 700 : 600,
              fontSize: 15,
              color: tab === t.value ? 'var(--color-purple)' : 'var(--color-ink-3)',
              background: 'none',
              border: 'none',
              borderBottom:
                tab === t.value
                  ? '2px solid var(--color-purple)'
                  : '2px solid transparent',
              padding: '10px 20px',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range picker */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <label
          style={{
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            color: 'var(--color-ink-2)',
          }}
        >
          From
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            padding: '8px 12px',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-ink)',
          }}
        />
        <label
          style={{
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            color: 'var(--color-ink-2)',
          }}
        >
          To
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            padding: '8px 12px',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-ink)',
          }}
        />
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
        </div>
      )}

      {/* Enrollment tab */}
      {!isLoading && tab === 'enrollment' && enrollment.data && (
        <EnrollmentTab data={enrollment.data} />
      )}

      {/* Revenue tab */}
      {!isLoading && tab === 'revenue' && revenue.data && (
        <RevenueTab data={revenue.data} />
      )}

      {/* Attendance tab */}
      {!isLoading && tab === 'attendance' && attendance.data && (
        <AttendanceTab data={attendance.data} />
      )}
    </div>
  )
}

// ── Summary card ─────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-ink-3)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          color: accent,
          lineHeight: 1.1,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ── Table styles ─────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--color-ink-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-body)',
  borderBottom: '2px solid var(--color-line)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  color: 'var(--color-ink)',
  borderBottom: '1px solid var(--color-line)',
}

// ── Enrollment tab ───────────────────────────────────────────────────

function EnrollmentTab({ data }: { data: EnrollmentReport }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <SummaryCard label="Total Active" value={data.summary.total_active} accent="var(--color-purple)" />
        <SummaryCard label="New Enrollments" value={data.summary.new_enrollments} accent="var(--color-green-deep)" />
        <SummaryCard label="Drops" value={data.summary.drops} accent="var(--color-red-deep)" />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState message="No enrollment data for this period" />
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Class</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Active</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Waitlist</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Dropped</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.class_name}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.class_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.active}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.waitlist}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.dropped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Revenue tab ──────────────────────────────────────────────────────

function RevenueTab({ data }: { data: RevenueReport }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <SummaryCard label="Collected" value={formatCurrency(data.summary.total_collected)} accent="var(--color-green-deep)" />
        <SummaryCard label="Outstanding" value={formatCurrency(data.summary.outstanding)} accent="var(--color-purple)" />
        <SummaryCard label="Overdue" value={formatCurrency(data.summary.overdue)} accent="var(--color-red-deep)" />
      </div>

      {/* Payment method breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <SummaryCard label="Stripe" value={formatCurrency(data.summary.by_method.stripe)} accent="var(--color-ink-2)" />
        <SummaryCard label="Cash" value={formatCurrency(data.summary.by_method.cash)} accent="var(--color-ink-2)" />
        <SummaryCard label="Check" value={formatCurrency(data.summary.by_method.check)} accent="var(--color-ink-2)" />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState message="No revenue data for this period" />
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Month</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Collected</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.month}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.month}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(row.collected)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(row.invoiced)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Attendance tab ───────────────────────────────────────────────────

function AttendanceTab({ data }: { data: AttendanceReport }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <SummaryCard label="Overall Rate" value={`${data.summary.overall_rate}%`} accent="var(--color-purple)" />
        <SummaryCard label="Present" value={data.summary.present} accent="var(--color-green-deep)" />
        <SummaryCard label="Absent" value={data.summary.absent} accent="var(--color-red-deep)" />
        <SummaryCard label="Late" value={data.summary.late} accent="var(--color-ink-2)" />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState message="No attendance data for this period" />
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Class</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Records</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Present</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Absent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Late</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Excused</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.class_name}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{row.class_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.total_records}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.present}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.absent}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.late}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.excused}</td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      color:
                        row.rate >= 90
                          ? 'var(--color-green-deep)'
                          : row.rate >= 75
                            ? 'var(--color-ink-2)'
                            : 'var(--color-red-deep)',
                    }}
                  >
                    {row.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  )
}
