import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * Parent portal data hooks (Plan 04-03, T-04-03-03)
 *
 * All hooks hit /parent/* endpoints which are scoped to the parent's
 * family_id in the JWT. No family ID is passed as a parameter — the
 * server reads it from app_metadata.
 */

const API_URL = import.meta.env.VITE_API_URL as string

// ── Response types ──────────────────────────────────────────────────

export interface ParentFamily {
  id: string
  primary_guardian_name: string
  secondary_guardian_name: string | null
  email: string
  phone: string | null
}

export interface ParentStudent {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  active: boolean
  enrollments: Array<{
    enrollment_id: string
    status: string
    class: {
      id: string
      name: string
      day_of_week: number | null
      start_time: string
      duration_minutes: number
      room: string | null
      level: string | null
      staff: { first_name: string; last_name: string } | null
    } | null
  }>
}

export interface ParentDashboardData {
  family: ParentFamily
  students: ParentStudent[]
}

export interface ParentClass {
  id: string
  name: string
  type: string
  day_of_week: number | null
  start_time: string
  duration_minutes: number
  room: string | null
  level: string | null
  age_min: number | null
  age_max: number | null
  staff: { first_name: string; last_name: string } | null
  enrolled_students: Array<{
    id: string
    first_name: string
    last_name: string
  }>
}

export interface ParentAttendanceRecord {
  id: string
  student_id: string
  status: string
  created_at: string
  students: { first_name: string; last_name: string } | null
  class_sessions: {
    session_date: string
    classes: { name: string; start_time: string } | null
  } | null
}

export interface ParentProfile {
  id: string
  primary_guardian_name: string
  secondary_guardian_name: string | null
  email: string
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address: string | null
}

export interface ParentInvoice {
  id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'waived'
  due_date: string
  line_items: unknown
  created_at: string
}

export interface PayInvoiceResponse {
  clientSecret: string
  amount: number
  invoiceId: string
}

// ── Hooks ───────────────────────────────────────────────────────────

/**
 * useParentDashboard — fetches family overview with students and enrolled classes.
 */
export function useParentDashboard() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<ParentDashboardData>({
    queryKey: ['parent', 'dashboard'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/parent/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useParentClasses — fetches all classes the family's students are enrolled in.
 */
export function useParentClasses() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<{ classes: ParentClass[] }>({
    queryKey: ['parent', 'classes'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/parent/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch classes: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useParentAttendance — fetches attendance records with optional filters.
 */
export function useParentAttendance(filters: {
  studentId?: string
  startDate?: string
  endDate?: string
} = {}) {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<{ records: ParentAttendanceRecord[] }>({
    queryKey: ['parent', 'attendance', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.studentId) params.set('studentId', filters.studentId)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const qs = params.toString()
      const res = await fetch(`${API_URL}/parent/attendance${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch attendance: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useParentProfile — fetches the family's contact information.
 */
export function useParentProfile() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<ParentProfile>({
    queryKey: ['parent', 'profile'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/parent/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })
}

/**
 * useUpdateParentProfile — mutation to update family contact info.
 */
export function useUpdateParentProfile() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`${API_URL}/parent/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update profile' }))
        throw new Error(err.error || 'Failed to update profile')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'dashboard'] })
    },
  })
}

// ── Invoice hooks (Plan 04-04) ──────────────────────────────────────

/**
 * useParentInvoices -- fetches all invoices for the parent's family.
 */
export function useParentInvoices() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<{ invoices: ParentInvoice[] }>({
    queryKey: ['parent', 'invoices'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/parent/invoices`, {
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
 * usePayInvoice -- mutation to create a PaymentIntent for an invoice.
 *
 * Returns clientSecret for Stripe Elements and invalidates invoice list
 * on success (status will update via webhook).
 */
export function usePayInvoice() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  return useMutation<PayInvoiceResponse, Error, string>({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`${API_URL}/parent/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start payment' }))
        throw new Error(err.error || 'Failed to start payment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'invoices'] })
    },
  })
}
