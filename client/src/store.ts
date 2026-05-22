import { create } from 'zustand'

/**
 * App-level Zustand store.
 *
 * submittedAtMap: tracks submittedAt timestamps returned by POST /sessions/:id/submit.
 * Keyed by sessionId -> ISO timestamp string. ClassList reads this to show
 * "Submitted at H:MM AM" on completed class cards without a re-fetch.
 *
 * Navigation is now handled by react-router-dom (see router.tsx).
 */
interface StoreState {
  submittedAtMap: Map<string, string>
  recordSubmittedAt: (sessionId: string, submittedAt: string) => void
}

export const useStore = create<StoreState>((set) => ({
  submittedAtMap: new Map<string, string>(),
  recordSubmittedAt: (sessionId, submittedAt) =>
    set((state) => ({
      submittedAtMap: new Map(state.submittedAtMap).set(sessionId, submittedAt),
    })),
}))
