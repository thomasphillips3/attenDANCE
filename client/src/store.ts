import { create } from 'zustand'

/**
 * App-level Zustand store.
 *
 * selectedSessionId: the class_sessions.id currently being viewed in the Roster
 * screen. null = show ClassList. non-null = show Roster for that session.
 *
 * Navigation model: App.tsx renders <Roster sessionId={...}> when non-null,
 * <ClassList> when null. No router needed for this two-screen MVP flow.
 *
 * submittedAtMap: tracks submittedAt timestamps returned by POST /sessions/:id/submit.
 * Keyed by sessionId → ISO timestamp string. ClassList reads this to show
 * "Submitted at H:MM AM" on completed class cards without a re-fetch.
 */
interface StoreState {
  selectedSessionId: string | null
  setSelectedSessionId: (id: string | null) => void
  submittedAtMap: Map<string, string>
  recordSubmittedAt: (sessionId: string, submittedAt: string) => void
}

export const useStore = create<StoreState>((set) => ({
  selectedSessionId: null,
  setSelectedSessionId: (id) => set({ selectedSessionId: id }),
  submittedAtMap: new Map<string, string>(),
  recordSubmittedAt: (sessionId, submittedAt) =>
    set((state) => ({
      submittedAtMap: new Map(state.submittedAtMap).set(sessionId, submittedAt),
    })),
}))
