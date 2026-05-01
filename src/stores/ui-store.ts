import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  activeViewId: string | null
  setActiveViewId: (id: string | null) => void

  followUpFromTicketId: string | null
  setFollowUpFromTicketId: (id: string | null) => void

  selectedTicketId: string | null
  setSelectedTicketId: (id: string | null) => void

  /**
   * The ticket the current user is actively viewing on the detail page.
   * Set by /tickets/[id] on mount, cleared on unmount. Read by the
   * global presence hook so the agent's "viewing" state can broadcast
   * to other agents without any per-route plumbing.
   */
  activeTicketId: string | null
  setActiveTicketId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  activeViewId: null,
  setActiveViewId: (id) => set({ activeViewId: id }),

  followUpFromTicketId: null,
  setFollowUpFromTicketId: (id) => set({ followUpFromTicketId: id }),

  selectedTicketId: null,
  setSelectedTicketId: (id) => set({ selectedTicketId: id }),

  activeTicketId: null,
  setActiveTicketId: (id) => set({ activeTicketId: id }),
}))
