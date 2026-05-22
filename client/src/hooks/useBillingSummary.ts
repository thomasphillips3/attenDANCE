import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'

/**
 * BillingSummary -- shape returned by GET /billing/summary.
 */
export interface BillingSummary {
  totalOutstanding: number
  collectedThisMonth: number
  overdueCount: number
  activePlansCount: number
}

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * useBillingSummary -- fetches aggregate billing metrics for the overview dashboard.
 */
export function useBillingSummary() {
  const { session } = useAuth()
  const token = session?.access_token

  return useQuery<BillingSummary>({
    queryKey: ['billing', 'summary'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/billing/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch billing summary: ${res.status}`)
      }

      return res.json()
    },
    enabled: !!token,
  })
}
