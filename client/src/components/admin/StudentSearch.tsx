import { useState, useEffect } from 'react'

interface StudentSearchProps {
  search: string
  onSearchChange: (val: string) => void
  activeFilter: boolean | undefined
  onActiveFilterChange: (val: boolean | undefined) => void
  classFilter: string | undefined
  onClassFilterChange: (val: string | undefined) => void
  classes: Array<{ id: string; name: string }>
}

/**
 * StudentSearch — search input with 300ms debounce, active/inactive filter
 * toggle, and class filter dropdown.
 *
 * All state is controlled by the parent (StudentsPage).
 * Debounce is internal — parent receives the debounced value.
 */
export default function StudentSearch({
  search,
  onSearchChange,
  activeFilter,
  onActiveFilterChange,
  classFilter,
  onClassFilterChange,
  classes,
}: StudentSearchProps) {
  // Internal state for debounced search input
  const [localSearch, setLocalSearch] = useState(search)

  // Sync external search prop changes (e.g. page navigation reset)
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  // Debounce: propagate localSearch to parent after 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, onSearchChange])

  const filterButtonStyle = (isActive: boolean): React.CSSProperties => ({
    height: 44,
    minHeight: 56, // 56px tap target via min-height
    padding: '8px 16px',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    fontWeight: isActive ? 700 : 400,
    background: isActive ? 'var(--color-purple)' : 'white',
    color: isActive ? 'white' : 'var(--color-ink-2)',
    border: isActive ? '1px solid var(--color-purple)' : '1px solid var(--color-line)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 16,
      }}
    >
      {/* Search input */}
      <input
        type="search"
        placeholder="Search students..."
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        style={{
          fontSize: 16,
          height: 48,
          padding: '12px 16px',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-body)',
          width: '100%',
          maxWidth: 360,
          boxSizing: 'border-box',
        }}
      />

      {/* Active/Inactive filter buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={() => onActiveFilterChange(undefined)}
          style={filterButtonStyle(activeFilter === undefined)}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onActiveFilterChange(true)}
          style={filterButtonStyle(activeFilter === true)}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => onActiveFilterChange(false)}
          style={filterButtonStyle(activeFilter === false)}
        >
          Inactive
        </button>
      </div>

      {/* Class filter dropdown */}
      <select
        value={classFilter || ''}
        onChange={(e) => onClassFilterChange(e.target.value || undefined)}
        style={{
          height: 44,
          minHeight: 56,
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          background: 'white',
        }}
      >
        <option value="">All Classes</option>
        {classes.map((cls) => (
          <option key={cls.id} value={cls.id}>
            {cls.name}
          </option>
        ))}
      </select>
    </div>
  )
}
