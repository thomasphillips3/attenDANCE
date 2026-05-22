import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient instance.
 *
 * Exported so sync.ts and Roster.tsx can call queryClient.invalidateQueries.
 * QueryClientProvider wraps the RouterProvider in main.tsx.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})
