import type { StateCreator } from 'zustand'
import type { RootStore } from '../../store/root.store'

export interface WindowSlice {
  windowId: string | null
  isMainWindow: boolean
  setWindowId: (id: string) => void
  setIsMainWindow: (v: boolean) => void
}

export const createWindowSlice: StateCreator<RootStore, [['zustand/immer', never]], [], WindowSlice> = (set) => ({
  windowId: null,
  isMainWindow: false,
  setWindowId: (id) =>
    set((state) => {
      state.windowId = id
    }),
  setIsMainWindow: (v) =>
    set((state) => {
      state.isMainWindow = v
    }),
})
