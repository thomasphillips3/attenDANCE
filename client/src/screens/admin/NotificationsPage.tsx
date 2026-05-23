import { useState } from 'react'
import { useNotifications, useBroadcast } from '../../hooks/useNotifications'
import type { NotificationEntry, BroadcastPayload } from '../../hooks/useNotifications'
import { useClasses } from '../../hooks/useClasses'

type ChannelFilter = '' | 'email' | 'sms'
type BroadcastChannel = 'email' | 'sms' | 'both'

const CHANNEL_TABS: { label: string; value: ChannelFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
]

const BROADCAST_CHANNELS: { label: string; value: BroadcastChannel }[] = [
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
  { label: 'Both', value: 'both' },
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
 * NotificationsPage -- admin communications hub.
 *
 * Two sections:
 * 1. Broadcast compose form with channel selector, class filter, and message
 * 2. Notification log table with channel filter tabs
 *
 * 56px+ tap targets, Atkinson Hyperlegible body font, purple/cream design tokens.
 */
export default function NotificationsPage() {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('')

  // Broadcast form state
  const [showCompose, setShowCompose] = useState(false)
  const [broadcastChannel, setBroadcastChannel] = useState<BroadcastChannel>('email')
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: response, isLoading } = useNotifications({
    channel: channelFilter || undefined,
  })
  const notifications = response?.data ?? []

  const { data: classes } = useClasses()
  const broadcast = useBroadcast()

  const handleClassToggle = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    )
  }

  const handleSendBroadcast = () => {
    const payload: BroadcastPayload = {
      channel: broadcastChannel,
      message: broadcastMessage,
    }
    if (selectedClassIds.length > 0) {
      payload.classIds = selectedClassIds
    }
    if (broadcastChannel === 'email' || broadcastChannel === 'both') {
      payload.subject = broadcastSubject
    }

    broadcast.mutate(payload, {
      onSuccess: () => {
        setShowConfirm(false)
        setShowCompose(false)
        setBroadcastChannel('email')
        setSelectedClassIds([])
        setBroadcastSubject('')
        setBroadcastMessage('')
      },
      onError: () => {
        setShowConfirm(false)
      },
    })
  }

  const canSend =
    broadcastMessage.trim().length > 0 &&
    ((broadcastChannel === 'sms') || broadcastSubject.trim().length > 0)

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
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
          Communications
        </h1>
        <button
          type="button"
          onClick={() => setShowCompose(!showCompose)}
          style={{
            height: 56,
            padding: '0 28px',
            fontSize: 18,
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--color-purple)',
            color: 'var(--color-white)',
            transition: 'opacity 150ms',
          }}
        >
          {showCompose ? 'Cancel' : 'New Broadcast'}
        </button>
      </div>

      {/* ================================================================= */}
      {/* Broadcast Compose Form                                            */}
      {/* ================================================================= */}
      {showCompose && (
        <div
          style={{
            background: 'var(--color-white)',
            border: '1px solid var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: 'var(--color-ink)',
              margin: '0 0 20px 0',
              fontWeight: 400,
            }}
          >
            Compose Broadcast
          </h2>

          {/* Channel selector */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-ink-2)',
                marginBottom: 6,
              }}
            >
              Send via
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {BROADCAST_CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setBroadcastChannel(ch.value)}
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
                      broadcastChannel === ch.value
                        ? 'var(--color-purple)'
                        : 'var(--color-cream)',
                    color:
                      broadcastChannel === ch.value
                        ? 'var(--color-white)'
                        : 'var(--color-ink-2)',
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class filter multi-select */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-ink-2)',
                marginBottom: 6,
              }}
            >
              Filter by class (optional -- leave empty for all families)
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(classes ?? []).map((cls) => {
                const selected = selectedClassIds.includes(cls.id)
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => handleClassToggle(cls.id)}
                    style={{
                      minHeight: 40,
                      padding: '6px 14px',
                      fontSize: 14,
                      fontWeight: 500,
                      fontFamily: 'var(--font-body)',
                      borderRadius: 'var(--radius-sm)',
                      border: selected
                        ? '2px solid var(--color-purple)'
                        : '1px solid var(--color-line)',
                      cursor: 'pointer',
                      background: selected ? 'var(--color-purple-tint-strong)' : 'var(--color-white)',
                      color: selected ? 'var(--color-purple)' : 'var(--color-ink-2)',
                      transition: 'all 150ms',
                    }}
                  >
                    {cls.name}
                  </button>
                )
              })}
              {(!classes || classes.length === 0) && (
                <span style={{ fontSize: 14, color: 'var(--color-ink-3)', fontStyle: 'italic' }}>
                  No classes found
                </span>
              )}
            </div>
          </div>

          {/* Subject (email only) */}
          {(broadcastChannel === 'email' || broadcastChannel === 'both') && (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  marginBottom: 6,
                }}
              >
                Subject
              </label>
              <input
                type="text"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="Enter email subject..."
                style={{
                  width: '100%',
                  height: 56,
                  padding: '0 16px',
                  fontSize: 18,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Message body */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-ink-2)',
                marginBottom: 6,
              }}
            >
              Message
            </label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              style={{
                width: '100%',
                padding: 16,
                fontSize: 18,
                fontFamily: 'var(--font-body)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-line)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
            {broadcastChannel === 'sms' && (
              <div
                style={{
                  fontSize: 13,
                  color:
                    broadcastMessage.length > 160
                      ? '#dc2626'
                      : 'var(--color-ink-3)',
                  marginTop: 4,
                }}
              >
                {broadcastMessage.length}/160 characters
                {broadcastMessage.length > 160 && ' (will be sent as multiple segments)'}
              </div>
            )}
          </div>

          {/* Send button */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!canSend || broadcast.isPending}
              onClick={() => setShowConfirm(true)}
              style={{
                height: 56,
                padding: '0 32px',
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: canSend && !broadcast.isPending ? 'pointer' : 'not-allowed',
                background: canSend ? 'var(--color-purple)' : 'var(--color-ink-3)',
                color: 'var(--color-white)',
                opacity: broadcast.isPending ? 0.6 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {broadcast.isPending ? 'Sending...' : 'Send Broadcast'}
            </button>

            {broadcast.isSuccess && (
              <span
                style={{
                  fontSize: 16,
                  color: '#166534',
                  fontWeight: 500,
                }}
              >
                Sent {broadcast.data.sent} messages to {broadcast.data.families} families
              </span>
            )}

            {broadcast.isError && (
              <span
                style={{
                  fontSize: 16,
                  color: '#dc2626',
                  fontWeight: 500,
                }}
              >
                {broadcast.error.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Confirm modal                                                     */}
      {/* ================================================================= */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--color-white)',
              borderRadius: 'var(--radius-md)',
              padding: 32,
              maxWidth: 440,
              width: '90%',
              fontFamily: 'var(--font-body)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: 'var(--color-ink)',
                margin: '0 0 12px 0',
                fontWeight: 400,
              }}
            >
              Confirm Broadcast
            </h3>
            <p style={{ fontSize: 16, color: 'var(--color-ink-2)', margin: '0 0 8px 0' }}>
              <strong>Channel:</strong> {broadcastChannel}
            </p>
            {selectedClassIds.length > 0 && (
              <p style={{ fontSize: 16, color: 'var(--color-ink-2)', margin: '0 0 8px 0' }}>
                <strong>Classes:</strong>{' '}
                {selectedClassIds
                  .map((id) => (classes ?? []).find((c) => c.id === id)?.name ?? id)
                  .join(', ')}
              </p>
            )}
            {!selectedClassIds.length && (
              <p style={{ fontSize: 16, color: 'var(--color-ink-2)', margin: '0 0 8px 0' }}>
                <strong>Audience:</strong> All families
              </p>
            )}
            <p
              style={{
                fontSize: 14,
                color: 'var(--color-ink-3)',
                margin: '12px 0 20px 0',
                fontStyle: 'italic',
              }}
            >
              This will send immediately and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  height: 56,
                  padding: '0 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  cursor: 'pointer',
                  background: 'var(--color-white)',
                  color: 'var(--color-ink-2)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={broadcast.isPending}
                style={{
                  height: 56,
                  padding: '0 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: broadcast.isPending ? 'not-allowed' : 'pointer',
                  background: 'var(--color-purple)',
                  color: 'var(--color-white)',
                  opacity: broadcast.isPending ? 0.6 : 1,
                }}
              >
                {broadcast.isPending ? 'Sending...' : 'Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Notification Log                                                   */}
      {/* ================================================================= */}

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
