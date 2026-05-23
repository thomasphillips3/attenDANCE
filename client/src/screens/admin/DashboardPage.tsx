import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'

/**
 * Dashboard API response shape from GET /dashboard/today.
 */
interface DashboardData {
  classesToday: number
  studentsCheckedIn: number
  totalEnrolledToday: number
  absencesToday: number
  excusedToday: number
  rfidCheckinsWeek: number
  classSummaries: ClassSummary[]
}

interface ClassSummary {
  sessionId: string
  classId: string
  className: string
  time: string
  instructorName?: string
  presentCount: number
  absentCount: number
  totalEnrolled: number
  status: string
  markedBy: string
}

/**
 * DashboardPage — admin operations dashboard with KPI cards and today's class summaries.
 *
 * Matches the admin.jsx mockup design:
 * - Top bar with date and "Today at the studio" headline
 * - 4 KPI cards: Classes today, Students checked in, Absences, RFID check-ins
 * - Today's classes grid with summary cards
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function DashboardPage() {
  const { session } = useAuth()
  const token = session?.access_token

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', 'today'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL as string
      const res = await fetch(`${apiUrl}/dashboard/today`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
    refetchInterval: 30_000, // Auto-refresh every 30s for live ops view
  })

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Compute subtitle strings for KPI cards
  const completedCount =
    data?.classSummaries.filter((c) => c.status === 'completed').length ?? 0
  const inProgressCount =
    data?.classSummaries.filter((c) => c.status === 'scheduled' && c.presentCount > 0).length ?? 0
  const classesSubtitle = `${completedCount} complete \u00b7 ${inProgressCount} in progress`

  const checkedInSub = `of ${data?.totalEnrolledToday ?? 0} enrolled today`

  const excused = data?.excusedToday ?? 0
  const unexcused = (data?.absencesToday ?? 0) - excused
  const absencesSub = `${excused} excused \u00b7 ${Math.max(0, unexcused)} unexcused`

  return (
    <div>
      {/* Top bar */}
      <div
        style={{
          marginBottom: 24,
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
          {dayName} &middot; {dateStr}
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
          Today at the studio
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
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
              marginBottom: 22,
            }}
          >
            <KpiCard
              label="Classes today"
              value={data.classesToday}
              subtitle={classesSubtitle}
              accent="var(--color-purple)"
            />
            <KpiCard
              label="Students checked in"
              value={data.studentsCheckedIn}
              subtitle={checkedInSub}
              accent="var(--color-green-deep)"
            />
            <KpiCard
              label="Absences today"
              value={data.absencesToday}
              subtitle={absencesSub}
              accent="var(--color-red-deep)"
            />
            <KpiCard
              label="RFID check-ins"
              value={data.rfidCheckinsWeek}
              subtitle="Last 7 days"
              accent="#3a3aa8"
              showRfidBadge
            />
          </div>

          {/* Today's classes header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                color: 'var(--color-ink)',
              }}
            >
              Today's classes
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
              {data.classSummaries.length} class
              {data.classSummaries.length !== 1 ? 'es' : ''} scheduled
            </div>
          </div>

          {/* Class summary cards grid */}
          {data.classSummaries.length === 0 ? (
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
              No classes scheduled for today
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(data.classSummaries.length, 4)}, 1fr)`,
                gap: 10,
              }}
            >
              {data.classSummaries.map((cls) => (
                <SummaryCard key={cls.sessionId} cls={cls} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * KpiCard — single KPI metric display card.
 */
function KpiCard({
  label,
  value,
  subtitle,
  accent,
  showRfidBadge,
}: {
  label: string
  value: number
  subtitle: string
  accent: string
  showRfidBadge?: boolean
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
        {showRfidBadge && <RfidBadge />}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38,
          color: accent,
          lineHeight: 1.05,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-ink-3)',
          marginTop: 2,
          fontFamily: 'var(--font-body)',
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}

/**
 * SummaryCard — today's class summary card with attendance progress bar.
 */
function SummaryCard({ cls }: { cls: ClassSummary }) {
  const pct = cls.totalEnrolled
    ? Math.round((cls.presentCount / cls.totalEnrolled) * 100)
    : 0

  const isComplete = cls.status === 'completed'
  const isPending = cls.presentCount === 0 && cls.absentCount === 0
  const isInProgress = !isComplete && !isPending

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-line)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      {/* Time + Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-ink-3)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-body)',
          }}
        >
          {cls.time}
        </div>
        <StatusBadge
          isComplete={isComplete}
          isInProgress={isInProgress}
        />
      </div>

      {/* Class name */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          color: 'var(--color-ink)',
          lineHeight: 1.15,
        }}
      >
        {cls.className}
      </div>

      {/* Instructor */}
      <div style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>
        {cls.instructorName ?? 'TBD'}
      </div>

      {/* Attendance count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            color: isPending ? 'var(--color-ink-3)' : 'var(--color-ink)',
          }}
        >
          {isPending
            ? '\u2014'
            : `${cls.presentCount}/${cls.totalEnrolled}`}
        </span>
        {!isPending && (
          <span
            style={{
              fontSize: 12,
              color:
                cls.absentCount > 0
                  ? 'var(--color-red-deep)'
                  : 'var(--color-ink-3)',
              fontWeight: 700,
            }}
          >
            {cls.absentCount} absent
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'var(--color-paper)',
          borderRadius: 99,
          overflow: 'hidden',
          marginTop: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: isPending ? '0%' : `${pct}%`,
            background: isComplete
              ? 'var(--color-green)'
              : 'var(--color-purple)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

/**
 * StatusBadge — Complete / In progress / Pending indicator.
 */
function StatusBadge({
  isComplete,
  isInProgress,
}: {
  isComplete: boolean
  isInProgress: boolean
}) {
  if (isComplete) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-green-deep)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M2 6 L5 9 L10 3"
            stroke="var(--color-green)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Complete
      </span>
    )
  }

  if (isInProgress) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-purple)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-purple)',
            boxShadow: '0 0 0 4px var(--color-purple-tint)',
          }}
        />
        In progress
      </span>
    )
  }

  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-ink-3)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      Pending
    </span>
  )
}

/**
 * RfidBadge — small RFID indicator badge used in the KPI card.
 */
function RfidBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: '#eef2ff',
        color: '#3a3aa8',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 7px 3px 6px',
        borderRadius: 6,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        border: '1px solid #d4d8f5',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path
          d="M2 4c2-2 6-2 8 0M3.5 6c1.4-1.4 3.6-1.4 5 0M6 8.5v.5"
          stroke="#3a3aa8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      RFID
    </span>
  )
}
