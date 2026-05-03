import type { StateCreator } from 'zustand'
import type { RootStore } from '../../store/root.store'

export interface WindowSlice {
  windowId: string | null
  isMainWindow: boolean
  isDashboardOpen: boolean
  setWindowId: (id: string) => void
  setIsMainWindow: (v: boolean) => void
  toggleDashboard: () => void
}

export const createWindowSlice: StateCreator<RootStore, [['zustand/immer', never]], [], WindowSlice> = (set) => ({
  windowId: null,
  isMainWindow: false,
  isDashboardOpen: true,
  setWindowId: (id) =>
    set((state) => {
      state.windowId = id
    }),
  setIsMainWindow: (v) =>
    set((state) => {
      state.isMainWindow = v
    }),
  toggleDashboard: () =>
    set((state) => {
      state.isDashboardOpen = !state.isDashboardOpen
    })
})
