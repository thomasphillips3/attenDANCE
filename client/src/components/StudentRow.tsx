import type { RosterStudent } from '../hooks/useRoster'

interface StudentRowProps {
  student: RosterStudent
  currentStatus: string | null
  onMark: (studentId: string, status: string) => void
}

type StatusKey = 'present' | 'absent' | 'late' | 'excused'

const STATUS_CONFIG: Record<StatusKey, { label: string; abbr: string; activeColor: string }> = {
  present: { label: 'present', abbr: 'P', activeColor: 'var(--color-green)' },
  absent:  { label: 'absent',  abbr: 'A', activeColor: 'var(--color-red)' },
  late:    { label: 'late',    abbr: 'L', activeColor: 'var(--color-gold)' },
  excused: { label: 'excused', abbr: 'E', activeColor: 'var(--color-purple)' },
}

const STATUS_KEYS: StatusKey[] = ['present', 'absent', 'late', 'excused']

/**
 * StudentRow — single student row in the Roster screen.
 *
 * Visual spec from interfaces block / screens.jsx:
 * - Row: full width, min-height 56px, flex row, align-items center, padding 0 16px
 * - border-bottom 1px --color-line
 * - Left: "{firstName} {lastName}" 20px bold --color-ink, flex-grow 1
 * - Right: four buttons P | A | L | E
 *   Each: min-width 56px, min-height 56px, border-radius --radius-sm
 *   Active: bg semantic color, text white
 *   Inactive: bg transparent, border 1px --color-line, text --color-ink-3
 *
 * Marking: onMark fires immediately on tap. Plan 03 adds the IndexedDB write
 * and API call inside the Roster screen's onMark handler.
 */
export function StudentRow({ student, currentStatus, onMark }: StudentRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 56,
        padding: '0 16px',
        borderBottom: '1px solid var(--color-line)',
        gap: 8,
      }}
    >
      {/* Student name — left, grows to fill available space */}
      <div
        style={{
          flex: 1,
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {student.firstName} {student.lastName}
      </div>

      {/* Status buttons: P | A | L | E — right side, fixed size */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {STATUS_KEYS.map((status) => {
          const config = STATUS_CONFIG[status]
          const isActive = currentStatus === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => onMark(student.studentId, status)}
              aria-label={`Mark ${student.firstName} ${config.label}`}
              aria-pressed={isActive}
              style={{
                minWidth: 56,
                minHeight: 56,
                borderRadius: 'var(--radius-sm)',
                border: isActive ? 'none' : '1px solid var(--color-line)',
                background: isActive ? config.activeColor : 'transparent',
                color: isActive ? 'white' : 'var(--color-ink-3)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              {config.abbr}
            </button>
          )
        })}
      </div>
    </div>
  )
}
