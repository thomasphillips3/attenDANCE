import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Invoice -- shape returned by GET /invoices.
 * Snake_case to match the Supabase/Fastify API response directly.
 */
export interface Invoice {
  id: string
  organization_id: string
  family_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'waived'
  due_date: string
  stripe_invoice_id: string | null
  created_at: string
  updated_at: string
  families: {
    id: string
    primary_guardian_name: string
    email: string
  } | null
}

/**
 * InvoiceDetail -- shape returned by GET /invoices/:id (includes payments).
 */
export interface InvoiceDetail extends Invoice {
  payments: Array<{
    id: string
    amount: number
    method: 'stripe' | 'cash' | 'check'
    paid_at: string
    notes: string | null
    created_at: string
  }>
}

/**
 * InvoiceListResponse -- paginated response from GET /invoices.
 */
interface InvoiceListResponse {
  data: Invoice[]
  total: number
  page: number
  limit: number
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useInvoices -- fetches a paginated list of invoices with optional filters.
 */
export function useInvoices(filters?: {
  familyId?: string
  status?: string
  page?: number
}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<InvoiceListResponse>({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.familyId) params.set('familyId', filters.familyId)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.page && filters.page > 1) params.set('page', String(filters.page))

      const qs = params.toString()
      const res = await fetch(`${API_URL}/invoices${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch invoices: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useInvoice -- fetches a single invoice by ID with payment history.
 */
export function useInvoice(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<InvoiceDetail>({
    queryKey: ['invoices', 'detail', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch invoice: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useGenerateInvoice -- mutation to generate an invoice for a family.
 * Invalidates the invoices list on success.
 */
export function useGenerateInvoice() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: { familyId: string }) => {
      const res = await fetch(`${API_URL}/invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate invoice' }))
        throw new Error(err.error || 'Failed to generate invoice')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

/**
 * useUpdateInvoice -- mutation to update an invoice (e.g. waive).
 * Invalidates both the list and the specific invoice detail.
 */
export function useUpdateInvoice() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'waived' }) => {
      const res = await fetch(`${API_URL}/invoices/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update invoice' }))
        throw new Error(err.error || 'Failed to update invoice')
      }

      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', variables.id] })
    },
  })
}
