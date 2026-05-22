import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * NotificationEntry -- shape returned by GET /notifications.
 * Snake_case to match the Supabase/Fastify API response directly.
 */
export interface NotificationEntry {
  id: string
  organization_id: string
  family_id: string | null
  student_id: string | null
  type: 'email' | 'sms'
  recipient: string
  subject: string | null
  template_key: string | null
  payload: Record<string, unknown>
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  external_id: string | null
  error_message: string | null
  sent_at: string
  created_at: string
}

interface NotificationListResponse {
  data: NotificationEntry[]
  total: number
  limit: number
  offset: number
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useNotifications -- fetches a paginated list of notifications with optional channel filter.
 */
export function useNotifications(filters?: {
  channel?: 'email' | 'sms'
  limit?: number
  offset?: number
}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<NotificationListResponse>({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.channel) params.set('channel', filters.channel)
      if (filters?.limit) params.set('limit', String(filters.limit))
      if (filters?.offset) params.set('offset', String(filters.offset))

      const qs = params.toString()
      const res = await fetch(`${API_URL}/notifications${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch notifications: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}
