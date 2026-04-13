import { create } from 'zustand'

interface NotificationState {
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  panelOpen: false,
  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}))
