import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Student — shape returned by GET /students (list endpoint).
 * Uses snake_case to match the Supabase/Fastify API response directly.
 * medical_notes is excluded from the list endpoint (children's data protection).
 */
export interface Student {
  id: string
  organization_id: string
  family_id: string
  first_name: string
  last_name: string
  dob: string | null
  photo_url: string | null
  active: boolean
  skill_level: string | null
  created_at: string
  updated_at: string
  families: {
    primary_guardian_name: string
    email: string
  } | null
}

/**
 * RfidCard — shape returned as part of student detail.
 */
export interface RfidCard {
  id: string
  organization_id: string
  student_id: string
  card_uid: string
  issued_at: string
  active: boolean
  created_at: string
}

/**
 * StudentDetail — shape returned by GET /students/:id (detail endpoint).
 * Includes medical_notes, signed photo URL, RFID cards, and expanded family.
 */
export interface StudentDetail {
  id: string
  organization_id: string
  family_id: string
  first_name: string
  last_name: string
  dob: string | null
  photo_url: string | null
  active: boolean
  skill_level: string | null
  medical_notes: string | null
  created_at: string
  updated_at: string
  families: {
    id: string
    primary_guardian_name: string
    email: string
    phone: string | null
  } | null
  signedPhotoUrl: string | null
  rfidCards: RfidCard[]
}

/**
 * StudentListResponse — paginated response from GET /students.
 */
interface StudentListResponse {
  data: Student[]
  total: number
  page: number
  limit: number
}

/**
 * StudentFilters — query parameters for the student list.
 */
export interface StudentFilters {
  search?: string
  active?: boolean
  classId?: string
  page?: number
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useStudents — fetches a paginated, filterable list of students.
 * Search, active status, class enrollment, and pagination all supported.
 */
export function useStudents(filters: StudentFilters = {}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<StudentListResponse>({
    queryKey: ['students', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.active !== undefined) params.set('active', String(filters.active))
      if (filters.classId) params.set('classId', filters.classId)
      if (filters.page) params.set('page', String(filters.page))

      const qs = params.toString()
      const res = await fetch(`${API_URL}/students${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch students: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useStudent — fetches a single student by ID with full detail
 * (medical_notes, signed photo URL, RFID cards).
 */
export function useStudent(id: string | undefined) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<StudentDetail>({
    queryKey: ['students', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch student: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token && !!id,
  })
}

/**
 * useCreateStudent — mutation to create a new student.
 * Invalidates the students list on success.
 */
export function useCreateStudent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create student' }))
        throw new Error(err.error || 'Failed to create student')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

/**
 * useUpdateStudent — mutation to update an existing student.
 * Invalidates both the list and the specific student detail.
 */
export function useUpdateStudent(id: string) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/students/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update student' }))
        throw new Error(err.error || 'Failed to update student')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['students', id] })
    },
  })
}
