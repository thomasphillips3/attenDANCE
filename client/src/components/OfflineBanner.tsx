interface OfflineBannerProps {
  pendingCount: number
}

/**
 * OfflineBanner — fixed bottom banner showing pending attendance sync count.
 *
 * Returns null when pendingCount === 0 (no render cost when queue is empty).
 *
 * Visual spec:
 * - Fixed position: bottom-0 left-0 right-0 z-50
 * - Background: #f3e3b8 (--color-gold-soft)
 * - Text: #6e521a (--color-gold-ink), 14px
 * - Padding: 10px 24px
 * - Content: "{N} record(s) pending sync" with a sync icon
 *
 * pendingCount is reactive (from useLiveQuery in useSyncOnReconnect) — the
 * banner decrements in real time as drainQueue marks entries synced.
 */
export function OfflineBanner({ pendingCount }: OfflineBannerProps) {
  if (pendingCount === 0) return null

  const label = pendingCount !== 1 ? 'records' : 'record'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '10px 24px',
        background: '#f3e3b8',
        color: '#6e521a',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Sync icon — clockwise circle arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.38-3.64"
          stroke="#6e521a"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M12.12 1.5v3h-3"
          stroke="#6e521a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {pendingCount} {label} pending sync
    </div>
  )
}
