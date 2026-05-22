/**
 * Roster screen — stub created by Task 2 to satisfy TypeScript import in App.tsx.
 * Full implementation wired in Task 3: useRoster hook, StudentRow components,
 * present/absent counts, and 56px tap targets on all four status buttons.
 */

interface RosterProps {
  sessionId: string
  onBack: () => void
}

export function Roster({ onBack }: RosterProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-cream)',
        gap: 16,
      }}
    >
      <p style={{ fontSize: 18, color: 'var(--color-ink-3)' }}>Loading roster…</p>
      <button
        type="button"
        onClick={onBack}
        style={{
          fontSize: 14,
          padding: '8px 20px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-line-strong)',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--color-purple)',
          fontWeight: 700,
        }}
      >
        Back
      </button>
    </div>
  )
}
