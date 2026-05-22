import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Payment -- shape returned by GET /payments.
 * Snake_case to match the Supabase/Fastify API response directly.
 */
export interface Payment {
  id: string
  organization_id: string
  invoice_id: string
  amount: number
  method: 'stripe' | 'cash' | 'check'
  paid_at: string
  stripe_payment_intent_id: string | null
  notes: string | null
  created_at: string
  invoices: {
    id: string
    family_id: string
    amount: number
    status: string
    due_date: string
  } | null
}

/**
 * PaymentListResponse -- paginated response from GET /payments.
 */
interface PaymentListResponse {
  data: Payment[]
  total: number
  page: number
  limit: number
}

/**
 * RecordPaymentPayload -- body sent to POST /payments.
 */
export interface RecordPaymentPayload {
  invoiceId: string
  amount: number
  method: 'cash' | 'check'
  notes?: string
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * usePayments -- fetches a paginated list of payments with optional filters.
 */
export function usePayments(filters?: {
  invoiceId?: string
  familyId?: string
  page?: number
}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<PaymentListResponse>({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.invoiceId) params.set('invoiceId', filters.invoiceId)
      if (filters?.familyId) params.set('familyId', filters.familyId)
      if (filters?.page && filters.page > 1) params.set('page', String(filters.page))

      const qs = params.toString()
      const res = await fetch(`${API_URL}/payments${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch payments: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useRecordPayment -- mutation to record a manual payment (cash/check).
 * Invalidates both payments and invoices lists on success, since a
 * payment may update the invoice status to 'paid'.
 */
export function useRecordPayment() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: RecordPaymentPayload) => {
      const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to record payment' }))
        throw new Error(err.error || 'Failed to record payment')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
