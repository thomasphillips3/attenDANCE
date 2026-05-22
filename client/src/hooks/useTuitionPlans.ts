import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * TuitionPlan -- shape returned by GET /tuition-plans.
 * Snake_case to match the Supabase/Fastify API response directly.
 */
export interface TuitionPlan {
  id: string
  organization_id: string
  class_id: string | null
  amount: number
  interval: 'monthly' | 'per_session' | 'seasonal'
  stripe_price_id: string | null
  active: boolean
  created_at: string
  updated_at: string
  classes: { id: string; name: string } | null
}

/**
 * CreateTuitionPlanPayload -- body sent to POST /tuition-plans.
 */
export interface CreateTuitionPlanPayload {
  classId?: string
  amount: number
  interval: 'monthly' | 'per_session' | 'seasonal'
}

/**
 * UpdateTuitionPlanPayload -- body sent to PATCH /tuition-plans/:id.
 */
export interface UpdateTuitionPlanPayload {
  classId?: string
  amount?: number
  interval?: 'monthly' | 'per_session' | 'seasonal'
  active?: boolean
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useTuitionPlans -- fetches all tuition plans for the current org.
 * Optional classId filter.
 */
export function useTuitionPlans(classId?: string) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<TuitionPlan[]>({
    queryKey: ['tuition-plans', classId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (classId) params.set('classId', classId)

      const qs = params.toString()
      const res = await fetch(`${API_URL}/tuition-plans${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch tuition plans: ${res.status}`)
      }

      const json = await res.json()
      return json.data
    },
    enabled: !!token,
  })
}

/**
 * useTuitionPlan -- fetches a single tuition plan by ID.
 */
export function useTuitionPlan(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<TuitionPlan>({
    queryKey: ['tuition-plans', 'detail', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/tuition-plans/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch tuition plan: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useCreateTuitionPlan -- mutation to create a new tuition plan.
 * Invalidates the tuition-plans list on success.
 */
export function useCreateTuitionPlan() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateTuitionPlanPayload) => {
      const res = await fetch(`${API_URL}/tuition-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create tuition plan' }))
        throw new Error(err.error || 'Failed to create tuition plan')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuition-plans'] })
    },
  })
}

/**
 * useUpdateTuitionPlan -- mutation to update an existing tuition plan.
 * Invalidates both the list and the specific plan detail.
 */
export function useUpdateTuitionPlan(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateTuitionPlanPayload) => {
      const res = await fetch(`${API_URL}/tuition-plans/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update tuition plan' }))
        throw new Error(err.error || 'Failed to update tuition plan')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuition-plans'] })
    },
  })
}

/**
 * useDeleteTuitionPlan -- mutation to soft-delete (deactivate) a tuition plan.
 */
export function useDeleteTuitionPlan() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/tuition-plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete tuition plan' }))
        throw new Error(err.error || 'Failed to delete tuition plan')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuition-plans'] })
    },
  })
}
