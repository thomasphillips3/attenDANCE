import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * AdminSidebar -- vertical navigation for the admin panel.
 *
 * 5 nav items per user decision:
 * - Dashboard (grayed, coming soon)
 * - Students (active NavLink to /admin/students)
 * - Classes (active NavLink to /admin/classes)
 * - Attendance (grayed, coming soon)
 * - Reports (grayed, coming soon)
 *
 * Design:
 * - 240px fixed width, white background, right border
 * - Top: LSODance logotype at 18px
 * - Nav: 56px min-height items (accessibility tap target)
 * - Bottom: "Admin Panel" label, user email, sign out button
 * - Active NavLink: purple tint background, left border, purple text
 */
export default function AdminSidebar() {
  const { user, logout } = useAuth()

  return (
    <aside
      style={{
        width: 240,
        background: 'var(--color-white)',
        borderRight: '1px solid var(--color-line)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        flexShrink: 0,
      }}
    >
      {/* Top: logotype */}
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '-0.01em',
            color: 'var(--color-purple)',
            display: 'inline-flex',
            alignItems: 'baseline',
          }}
        >
          <span>LSO</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontStyle: 'italic',
              marginLeft: 1,
            }}
          >
            Dance
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {/* Dashboard -- grayed */}
        <span
          style={{
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: 0.4,
            cursor: 'not-allowed',
            color: 'var(--color-ink-2)',
            borderLeft: '3px solid transparent',
          }}
          title="Coming soon"
        >
          Dashboard
        </span>

        {/* Students -- active */}
        <NavLink
          to="/admin/students"
          style={({ isActive }) => ({
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: isActive ? 700 : 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: isActive ? 'var(--color-purple)' : 'var(--color-ink-2)',
            background: isActive ? 'var(--color-purple-tint)' : 'transparent',
            borderLeft: isActive
              ? '3px solid var(--color-purple)'
              : '3px solid transparent',
          })}
        >
          Students
        </NavLink>

        {/* Classes -- active */}
        <NavLink
          to="/admin/classes"
          style={({ isActive }) => ({
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: isActive ? 700 : 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: isActive ? 'var(--color-purple)' : 'var(--color-ink-2)',
            background: isActive ? 'var(--color-purple-tint)' : 'transparent',
            borderLeft: isActive
              ? '3px solid var(--color-purple)'
              : '3px solid transparent',
          })}
        >
          Classes
        </NavLink>

        {/* Billing -- active */}
        <NavLink
          to="/admin/billing"
          style={({ isActive }) => ({
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: isActive ? 700 : 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: isActive ? 'var(--color-purple)' : 'var(--color-ink-2)',
            background: isActive ? 'var(--color-purple-tint)' : 'transparent',
            borderLeft: isActive
              ? '3px solid var(--color-purple)'
              : '3px solid transparent',
          })}
        >
          Billing
        </NavLink>

        {/* Attendance -- grayed */}
        <span
          style={{
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: 0.4,
            cursor: 'not-allowed',
            color: 'var(--color-ink-2)',
            borderLeft: '3px solid transparent',
          }}
          title="Coming soon"
        >
          Attendance
        </span>

        {/* Reports -- grayed */}
        <span
          style={{
            minHeight: 56,
            padding: '12px 16px',
            fontSize: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: 0.4,
            cursor: 'not-allowed',
            color: 'var(--color-ink-2)',
            borderLeft: '3px solid transparent',
          }}
          title="Coming soon"
        >
          Reports
        </span>
      </nav>

      {/* Bottom: admin label + user info + sign out */}
      <div
        style={{
          padding: 16,
          borderTop: '1px solid var(--color-line)',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-ink-3)',
            marginBottom: 4,
          }}
        >
          Admin Panel
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 12,
          }}
        >
          {user?.email ?? ''}
        </div>
        <button
          type="button"
          onClick={logout}
          style={{
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            color: 'var(--color-ink-3)',
            background: 'none',
            border: '1px solid var(--color-line-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 14px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
