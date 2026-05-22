import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Family — shape returned by GET /families (list endpoint).
 * studentCount is computed server-side from the students join.
 */
export interface Family {
  id: string
  organization_id: string
  primary_guardian_name: string
  secondary_guardian_name: string | null
  email: string
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
  studentCount: number
}

/**
 * FamilyDetail — shape returned by GET /families/:id (detail endpoint).
 * Includes linked students array.
 */
export interface FamilyDetail {
  id: string
  organization_id: string
  primary_guardian_name: string
  secondary_guardian_name: string | null
  email: string
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
  students: Array<{
    id: string
    first_name: string
    last_name: string
    active: boolean
    photo_url: string | null
  }>
}

/**
 * FamilyListResponse — paginated response from GET /families.
 */
interface FamilyListResponse {
  data: Family[]
  total: number
  page: number
  limit: number
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useFamilies — fetches a paginated list of families with student counts.
 */
export function useFamilies(page: number = 1) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<FamilyListResponse>({
    queryKey: ['families', page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (page > 1) params.set('page', String(page))

      const qs = params.toString()
      const res = await fetch(`${API_URL}/families${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch families: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useFamily — fetches a single family by ID with linked students.
 */
export function useFamily(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<FamilyDetail>({
    queryKey: ['families', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/families/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch family: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useCreateFamily — mutation to create a new family.
 * Invalidates the families list on success.
 */
export function useCreateFamily() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/families`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create family' }))
        throw new Error(err.error || 'Failed to create family')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] })
    },
  })
}

/**
 * useUpdateFamily — mutation to update an existing family.
 * Invalidates both the list and the specific family detail.
 */
export function useUpdateFamily(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/families/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update family' }))
        throw new Error(err.error || 'Failed to update family')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] })
      queryClient.invalidateQueries({ queryKey: ['families', id] })
    },
  })
}
