import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TicketTab {
  id: string
  title: string
  requesterName?: string
}

interface TabState {
  tabs: TicketTab[]
  openTab: (tab: TicketTab) => void
  closeTab: (id: string) => string | null
  updateTab: (id: string, patch: Partial<Omit<TicketTab, 'id'>>) => void
}

const MAX_TABS = 10

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],

      openTab: (tab) => {
        set((state) => {
          const existing = state.tabs.find((t) => t.id === tab.id)
          if (existing) {
            // Skip if nothing actually changed — avoids persist-write churn
            // from per-render effect deps.
            if (
              existing.title === tab.title &&
              existing.requesterName === tab.requesterName
            ) {
              return state
            }
            return {
              tabs: state.tabs.map((t) =>
                t.id === tab.id ? { ...t, ...tab } : t,
              ),
            }
          }
          const next = [...state.tabs, tab]
          if (next.length > MAX_TABS) next.shift()
          return { tabs: next }
        })
      },

      closeTab: (id) => {
        const tabs = get().tabs
        const idx = tabs.findIndex((t) => t.id === id)
        if (idx === -1) return null
        const remaining = tabs.filter((t) => t.id !== id)
        set({ tabs: remaining })
        // Suggest the next tab to navigate to: the one to the right, else
        // the new last tab, else null (caller routes to /tickets).
        return remaining[idx]?.id ?? remaining[remaining.length - 1]?.id ?? null
      },

      updateTab: (id, patch) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }))
      },
    }),
    { name: 'ticket-tabs' },
  ),
)
