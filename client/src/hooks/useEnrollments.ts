import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * EnrollResponse -- shape returned by POST /enrollments on success.
 */
export interface EnrollResponse {
  enrollmentId: string
  status: 'active' | 'waitlist'
  activeCount: number
  capacity: number | null
}

/**
 * TransferResponse -- shape returned by POST /enrollments/transfer on success.
 */
export interface TransferResponse {
  fromClassId: string
  fromStatus: string
  toClassId: string
  toStatus: string
  enrollmentId: string
}

/**
 * useEnrollStudent -- mutation to enroll a student in a class.
 * Calls POST /enrollments with { studentId, classId }.
 * Invalidates ['classes'] on success to refresh enrollment counts and detail.
 */
export function useEnrollStudent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation<EnrollResponse, Error, { studentId: string; classId: string }>({
    mutationFn: async ({ studentId, classId }) => {
      const res = await fetch(`${API_URL}/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId, classId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to enroll student' }))
        throw new Error(err.error || 'Failed to enroll student')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

/**
 * useDropStudent -- mutation to drop a student from a class.
 * Calls DELETE /enrollments/:id.
 * The server-side trigger auto-promotes the earliest waitlisted student.
 * Invalidates ['classes'] on success.
 */
export function useDropStudent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation<{ message: string; enrollmentId: string }, Error, string>({
    mutationFn: async (enrollmentId: string) => {
      const res = await fetch(`${API_URL}/enrollments/${enrollmentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to drop student' }))
        throw new Error(err.error || 'Failed to drop student')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

/**
 * useTransferStudent -- mutation to transfer a student between classes.
 * Calls POST /enrollments/transfer with { studentId, fromClassId, toClassId }.
 * The Postgres function handles this atomically.
 * Invalidates ['classes'] on success.
 */
export function useTransferStudent() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation<
    TransferResponse,
    Error,
    { studentId: string; fromClassId: string; toClassId: string }
  >({
    mutationFn: async ({ studentId, fromClassId, toClassId }) => {
      const res = await fetch(`${API_URL}/enrollments/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId, fromClassId, toClassId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to transfer student' }))
        throw new Error(err.error || 'Failed to transfer student')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}
