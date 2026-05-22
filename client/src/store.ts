import { create } from 'zustand'

/**
 * App-level Zustand store.
 *
 * selectedSessionId: the class_sessions.id currently being viewed in the Roster
 * screen. null = show ClassList. non-null = show Roster for that session.
 *
 * Navigation model: App.tsx renders <Roster sessionId={...}> when non-null,
 * <ClassList> when null. No router needed for this two-screen MVP flow.
 */
interface StoreState {
  selectedSessionId: string | null
  setSelectedSessionId: (id: string | null) => void
}

export const useStore = create<StoreState>((set) => ({
  selectedSessionId: null,
  setSelectedSessionId: (id) => set({ selectedSessionId: id }),
}))
