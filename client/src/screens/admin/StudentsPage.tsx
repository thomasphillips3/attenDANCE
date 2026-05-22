import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import StudentSearch from '../../components/admin/StudentSearch'
import type { Student } from '../../hooks/useStudents'

/**
 * StudentsPage — admin student list with search, active/inactive filter,
 * class enrollment filter, and pagination.
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function StudentsPage() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined)
  const [classFilter, setClassFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  // Fetch class list for the class filter dropdown
  const { data: classesData } = useClasses()
  const classList = (classesData ?? []).map((c) => ({ id: c.id, name: c.name }))

  // Fetch students with current filters
  const { data: studentsResponse, isLoading } = useStudents({
    search,
    active: activeFilter,
    classId: classFilter,
    page,
  })

  const students = studentsResponse?.data ?? []
  const total = studentsResponse?.total ?? 0
  const limit = studentsResponse?.limit ?? 50

  // Reset page when filters change
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    setPage(1)
  }, [])

  const handleActiveFilterChange = useCallback((val: boolean | undefined) => {
    setActiveFilter(val)
    setPage(1)
  }, [])

  const handleClassFilterChange = useCallback((val: string | undefined) => {
    setClassFilter(val)
    setPage(1)
  }, [])

  const from = (page - 1) * limit

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
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
          Students
        </h1>
        <Link
          to="/admin/students/new"
          style={{
            background: 'var(--color-purple)',
            color: 'white',
            fontSize: 16,
            fontWeight: 600,
            height: 48,
            minHeight: 56,
            padding: '0 24px',
            borderRadius: 'var(--radius-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            fontFamily: 'var(--font-body)',
          }}
        >
          Add Student
        </Link>
      </div>

      {/* Search and filters */}
      <StudentSearch
        search={search}
        onSearchChange={handleSearchChange}
        activeFilter={activeFilter}
        onActiveFilterChange={handleActiveFilterChange}
        classFilter={classFilter}
        onClassFilterChange={handleClassFilterChange}
        classes={classList}
      />

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

      {/* Empty state */}
      {!isLoading && students.length === 0 && (
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
          No students found
        </div>
      )}

      {/* Student list */}
      {!isLoading && students.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((student: Student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > limit && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 24,
            fontFamily: 'var(--font-body)',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--color-ink-3)' }}>
            Showing {from + 1}–{Math.min(from + limit, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                height: 56,
                padding: '0 16px',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                cursor: page <= 1 ? 'default' : 'pointer',
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={from + limit >= total}
              onClick={() => setPage((p) => p + 1)}
              style={{
                height: 56,
                padding: '0 16px',
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                cursor: from + limit >= total ? 'default' : 'pointer',
                opacity: from + limit >= total ? 0.4 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * StudentCard — single student row in the list.
 * Shows photo thumbnail, name, family, and active status.
 */
function StudentCard({ student }: { student: Student }) {
  return (
    <Link
      to={`/admin/students/${student.id}`}
      style={{
        background: 'white',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minHeight: 72,
        textDecoration: 'none',
        color: 'inherit',
        fontFamily: 'var(--font-body)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-purple-tint-strong)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-line)'
      }}
    >
      {/* Photo thumbnail — 40px circle */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--color-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {student.photo_url ? (
          <img
            src={student.photo_url}
            alt=""
            style={{ width: 40, height: 40, objectFit: 'cover' }}
          />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ink-3)"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        )}
      </div>

      {/* Name and family */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--color-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {student.first_name} {student.last_name}
        </div>
        {student.families?.primary_guardian_name && (
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {student.families.primary_guardian_name}
          </div>
        )}
      </div>

      {/* Active badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: student.active ? '#4CAF50' : 'var(--color-ink-3)',
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--color-ink-3)' }}>
          {student.active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </Link>
  )
}
