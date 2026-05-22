import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * ClassItem — shape returned by GET /classes (list endpoint).
 * Matches the server response with staff join and enrollment count.
 */
export interface ClassItem {
  id: string
  name: string
  type: 'recurring' | 'drop_in' | 'workshop'
  instructor_id: string | null
  day_of_week: number | null
  start_time: string
  duration_minutes: number
  room: string | null
  capacity: number | null
  age_min: number | null
  age_max: number | null
  level: string | null
  active: boolean
  staff: { id: string; first_name: string; last_name: string } | null
  enrolledCount: number
}

/**
 * ClassDetail — shape returned by GET /classes/:id (detail endpoint).
 * Extends ClassItem with enrollment breakdown.
 */
export interface ClassDetail extends ClassItem {
  activeEnrollments: Array<{
    id: string
    status: string
    student_id: string
    students: {
      id: string
      first_name: string
      last_name: string
      active: boolean
      photo_url: string | null
    }
  }>
  waitlistEnrollments: Array<{
    id: string
    status: string
    student_id: string
    students: {
      id: string
      first_name: string
      last_name: string
      active: boolean
      photo_url: string | null
    }
  }>
  waitlistCount: number
}

/**
 * CreateClassPayload — body sent to POST /classes.
 */
export interface CreateClassPayload {
  name: string
  type?: 'recurring' | 'drop_in' | 'workshop'
  instructorId?: string
  dayOfWeek?: number
  startTime: string
  durationMinutes: number
  room?: string
  capacity?: number
  ageMin?: number
  ageMax?: number
  level?: string
}

/**
 * UpdateClassPayload — body sent to PATCH /classes/:id.
 */
export interface UpdateClassPayload {
  name?: string
  type?: 'recurring' | 'drop_in' | 'workshop'
  instructorId?: string
  dayOfWeek?: number
  startTime?: string
  durationMinutes?: number
  room?: string
  capacity?: number
  ageMin?: number
  ageMax?: number
  level?: string
  active?: boolean
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useClasses — fetches all classes for the current org.
 */
export function useClasses() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<ClassItem[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch classes: ${res.status}`)
      }
      const json = await res.json()
      return json.data
    },
    enabled: !!token,
  })
}

/**
 * useClass — fetches a single class by ID with enrollment details.
 */
export function useClass(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<ClassDetail>({
    queryKey: ['classes', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/classes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch class: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useCreateClass — mutation to create a new class.
 * Invalidates the classes list on success.
 */
export function useCreateClass() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateClassPayload) => {
      const res = await fetch(`${API_URL}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create class' }))
        throw new Error(err.error || 'Failed to create class')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

/**
 * useUpdateClass — mutation to update an existing class.
 * Invalidates both the classes list and the specific class detail.
 */
export function useUpdateClass(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateClassPayload) => {
      const res = await fetch(`${API_URL}/classes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update class' }))
        throw new Error(err.error || 'Failed to update class')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['classes', id] })
    },
  })
}
