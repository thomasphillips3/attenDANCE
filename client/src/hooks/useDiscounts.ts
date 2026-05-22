import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Discount -- shape returned by GET /discounts.
 * Snake_case to match the Supabase/Fastify API response directly.
 */
export interface Discount {
  id: string
  organization_id: string
  family_id: string | null
  class_id: string | null
  type: 'sibling' | 'scholarship' | 'staff'
  amount: number | null
  percent: number | null
  active: boolean
  created_at: string
  updated_at: string
  families: { id: string; primary_guardian_name: string } | null
  classes: { id: string; name: string } | null
}

/**
 * CreateDiscountPayload -- body sent to POST /discounts.
 */
export interface CreateDiscountPayload {
  familyId?: string
  classId?: string
  type: 'sibling' | 'scholarship' | 'staff'
  amount?: number
  percent?: number
}

/**
 * UpdateDiscountPayload -- body sent to PATCH /discounts/:id.
 */
export interface UpdateDiscountPayload {
  familyId?: string
  classId?: string
  type?: 'sibling' | 'scholarship' | 'staff'
  amount?: number
  percent?: number
  active?: boolean
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useDiscounts -- fetches all discounts for the current org.
 * Optional familyId and classId filters.
 */
export function useDiscounts(filters?: { familyId?: string; classId?: string }) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<Discount[]>({
    queryKey: ['discounts', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.familyId) params.set('familyId', filters.familyId)
      if (filters?.classId) params.set('classId', filters.classId)

      const qs = params.toString()
      const res = await fetch(`${API_URL}/discounts${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch discounts: ${res.status}`)
      }

      const json = await res.json()
      return json.data
    },
    enabled: !!token,
  })
}

/**
 * useCreateDiscount -- mutation to create a new discount.
 * Invalidates the discounts list on success.
 */
export function useCreateDiscount() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateDiscountPayload) => {
      const res = await fetch(`${API_URL}/discounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create discount' }))
        throw new Error(err.error || 'Failed to create discount')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    },
  })
}

/**
 * useUpdateDiscount -- mutation to update an existing discount.
 */
export function useUpdateDiscount(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateDiscountPayload) => {
      const res = await fetch(`${API_URL}/discounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update discount' }))
        throw new Error(err.error || 'Failed to update discount')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    },
  })
}

/**
 * useDeleteDiscount -- mutation to soft-delete (deactivate) a discount.
 */
export function useDeleteDiscount() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/discounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete discount' }))
        throw new Error(err.error || 'Failed to delete discount')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
    },
  })
}
