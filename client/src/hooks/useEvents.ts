import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * EventItem — shape returned by GET /events (list endpoint).
 */
export interface EventItem {
  id: string
  organization_id: string
  name: string
  event_date: string
  venue: string | null
  type: 'recital' | 'showcase' | 'workshop' | 'camp'
  created_at: string
  updated_at: string
  enrolledCount: number
}

/**
 * EnrolledStudent — shape returned in event detail enrollments array.
 */
export interface EnrolledStudent {
  id: string
  student_id: string
  enrolled_at: string
  students: {
    id: string
    first_name: string
    last_name: string
  }
}

/**
 * CostumeEntry — shape returned in event detail costumes array.
 */
export interface CostumeEntry {
  id: string
  student_id: string
  description: string | null
  size: string | null
  ordered: boolean
  received: boolean
  paid: boolean
  created_at: string
  updated_at: string
  students: {
    id: string
    first_name: string
    last_name: string
  }
}

/**
 * EventDetail — shape returned by GET /events/:id.
 */
export interface EventDetail extends EventItem {
  enrollments: EnrolledStudent[]
  costumes: CostumeEntry[]
}

/**
 * CreateEventPayload — body sent to POST /events.
 */
export interface CreateEventPayload {
  name: string
  event_date: string
  venue?: string
  type: 'recital' | 'showcase' | 'workshop' | 'camp'
}

/**
 * UpdateEventPayload — body sent to PUT /events/:id.
 */
export interface UpdateEventPayload {
  name?: string
  event_date?: string
  venue?: string
  type?: 'recital' | 'showcase' | 'workshop' | 'camp'
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useEvents — fetches events list with optional filters.
 */
export function useEvents(filters: { upcoming?: boolean; type?: string } = {}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<EventItem[]>({
    queryKey: ['events', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.upcoming !== undefined) params.set('upcoming', String(filters.upcoming))
      if (filters.type) params.set('type', filters.type)
      const qs = params.toString()
      const res = await fetch(`${API_URL}/events${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch events: ${res.status}`)
      }
      const json = await res.json()
      return json.data
    },
    enabled: !!token,
  })
}

/**
 * useEvent — fetches a single event by ID with enrollments and costumes.
 */
export function useEvent(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<EventDetail>({
    queryKey: ['events', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch event: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useCreateEvent — mutation to create a new event.
 */
export function useCreateEvent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CreateEventPayload) => {
      const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create event' }))
        throw new Error(err.error || 'Failed to create event')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

/**
 * useUpdateEvent — mutation to update an event.
 */
export function useUpdateEvent(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UpdateEventPayload) => {
      const res = await fetch(`${API_URL}/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update event' }))
        throw new Error(err.error || 'Failed to update event')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
    },
  })
}

/**
 * useDeleteEvent — mutation to delete an event.
 */
export function useDeleteEvent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete event' }))
        throw new Error(err.error || 'Failed to delete event')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

/**
 * useEnrollStudents — mutation to bulk enroll students in an event.
 */
export function useEnrollStudents(eventId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (studentIds: string[]) => {
      const res = await fetch(`${API_URL}/events/${eventId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ student_ids: studentIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to enroll students' }))
        throw new Error(err.error || 'Failed to enroll students')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

/**
 * useRemoveEnrollment — mutation to remove a student from an event.
 */
export function useRemoveEnrollment(eventId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`${API_URL}/events/${eventId}/enroll/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to remove student' }))
        throw new Error(err.error || 'Failed to remove student')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

/**
 * useCreateCostume — mutation to create a costume entry.
 */
export function useCreateCostume(eventId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: { student_id: string; description?: string; size?: string }) => {
      const res = await fetch(`${API_URL}/events/${eventId}/costumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create costume' }))
        throw new Error(err.error || 'Failed to create costume')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] })
    },
  })
}

/**
 * useUpdateCostume — mutation to update a costume's status.
 */
export function useUpdateCostume(eventId: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      costumeId,
      ...body
    }: {
      costumeId: string
      ordered?: boolean
      received?: boolean
      paid?: boolean
      description?: string
      size?: string
    }) => {
      const res = await fetch(`${API_URL}/costumes/${costumeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update costume' }))
        throw new Error(err.error || 'Failed to update costume')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] })
    },
  })
}
