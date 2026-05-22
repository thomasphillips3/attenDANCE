import { useState } from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import type { NotificationEntry } from '../../hooks/useNotifications'

type ChannelFilter = '' | 'email' | 'sms'

const CHANNEL_TABS: { label: string; value: ChannelFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
]

const STATUS_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  pending: { background: '#fef9c3', color: '#854d0e' },
  sent: { background: '#dcfce7', color: '#166534' },
  delivered: { background: '#dcfce7', color: '#166534' },
  failed: { background: '#fef2f2', color: '#dc2626' },
  bounced: { background: '#fef2f2', color: '#dc2626' },
}

/**
 * Format a template_key like 'enrollment_confirmation' into 'Enrollment Confirmation'.
 */
function formatTemplateKey(key: string | null): string {
  if (!key) return '--'
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format an ISO timestamp for display.
 */
function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * NotificationsPage -- admin table of sent notifications with status badges.
 *
 * Channel filter tabs across the top. Table with recipient, subject, template,
 * status badge, and sent timestamp.
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function NotificationsPage() {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('')

  const { data: response, isLoading } = useNotifications({
    channel: channelFilter || undefined,
  })
  const notifications = response?.data ?? []

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          color: 'var(--color-ink)',
          margin: '0 0 24px 0',
        }}
      >
        Communications
      </h1>

      {/* Channel filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {CHANNEL_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setChannelFilter(tab.value)}
            style={{
              height: 44,
              padding: '0 20px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background:
                channelFilter === tab.value
                  ? 'var(--color-purple)'
                  : 'var(--color-cream)',
              color:
                channelFilter === tab.value
                  ? 'var(--color-white)'
                  : 'var(--color-ink-2)',
              transition: 'background 150ms, color 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            fontSize: 18,
            color: 'var(--color-ink-3)',
            fontStyle: 'italic',
          }}
        >
          {channelFilter
            ? `No ${channelFilter} notifications`
            : 'No notifications sent yet'}
        </div>
      )}

      {/* Notification table */}
      {!isLoading && notifications.length > 0 && (
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 16,
              fontFamily: 'var(--font-body)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-line)',
                  background: 'var(--color-cream)',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Recipient
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Subject
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Template
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-ink-2)',
                  }}
                >
                  Sent
                </th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((entry: NotificationEntry) => {
                const badgeStyle = STATUS_BADGE_STYLES[entry.delivery_status] ?? {
                  background: '#f3f4f6',
                  color: '#6b7280',
                }

                return (
                  <tr
                    key={entry.id}
                    style={{
                      borderBottom: '1px solid var(--color-line)',
                      minHeight: 56,
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.recipient}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink)',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.subject ?? '--'}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink-2)',
                      }}
                    >
                      {formatTemplateKey(entry.template_key)}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'center',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 12px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 600,
                          background: badgeStyle.background,
                          color: badgeStyle.color,
                          textTransform: 'capitalize',
                        }}
                      >
                        {entry.delivery_status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--color-ink-2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTimestamp(entry.sent_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Total count */}
      {!isLoading && response && response.total > 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: 'var(--color-ink-3)',
          }}
        >
          Showing {notifications.length} of {response.total} notifications
        </div>
      )}
    </div>
  )
}
