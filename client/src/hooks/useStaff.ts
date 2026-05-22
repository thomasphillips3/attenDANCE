import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * StaffMember — shape returned by GET /staff.
 * Used by the instructor picker in ClassForm.
 */
export interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useStaff — fetches active staff members for the current org.
 * Primary use: populating the instructor picker dropdown.
 */
export function useStaff() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch staff: ${res.status}`)
      }
      return res.json()
    },
    enabled: !!token,
  })
}
