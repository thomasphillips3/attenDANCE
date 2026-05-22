import { Link } from 'react-router-dom'
import { useFamilies } from '../../hooks/useFamilies'
import type { Family } from '../../hooks/useFamilies'

/**
 * FamiliesPage — admin family list with student count badges.
 *
 * Default export required for React.lazy in router.tsx.
 */
export default function FamiliesPage() {
  const { data: familiesResponse, isLoading } = useFamilies()
  const families = familiesResponse?.data ?? []

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
          Families
        </h1>
        <Link
          to="/admin/families/new"
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
          Add Family
        </Link>
      </div>

      {/* Loading state */}
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && families.length === 0 && (
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
          No families yet
        </div>
      )}

      {/* Family list */}
      {!isLoading && families.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {families.map((family: Family) => (
            <FamilyCard key={family.id} family={family} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * FamilyCard — single family row in the list.
 * Shows guardian name, email, phone, and student count badge.
 */
function FamilyCard({ family }: { family: Family }) {
  return (
    <Link
      to={`/admin/families/${family.id}`}
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
      {/* Family info */}
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
          {family.primary_guardian_name}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
          {family.email && (
            <span
              style={{
                fontSize: 14,
                color: 'var(--color-ink-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {family.email}
            </span>
          )}
          {family.phone && (
            <span style={{ fontSize: 14, color: 'var(--color-ink-3)' }}>
              {family.phone}
            </span>
          )}
        </div>
      </div>

      {/* Badges + Billing link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Student count badge */}
        <span
          style={{
            background: 'var(--color-purple-tint)',
            color: 'var(--color-purple)',
            fontSize: 13,
            padding: '2px 10px',
            borderRadius: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {family.studentCount} {family.studentCount === 1 ? 'student' : 'students'}
        </span>
        {/* Billing link -- onClick stopPropagation prevents the parent Link from navigating */}
        <Link
          to={`/admin/families/${family.id}/billing`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 40,
            padding: '4px 14px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            color: 'var(--color-purple)',
            background: 'var(--color-cream)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Billing
        </Link>
      </div>
    </Link>
  )
}
