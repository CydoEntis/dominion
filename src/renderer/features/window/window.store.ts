import type { StateCreator } from 'zustand'
import type { RootStore } from '../../store/root.store'

export interface WindowSlice {
  windowId: string | null
  isMainWindow: boolean
  windowName: string
  windowColor: string
  windowHighlighted: boolean
  totalWindowCount: number
  setWindowId: (id: string) => void
  setIsMainWindow: (v: boolean) => void
  setWindowMeta: (name: string, color: string) => void
  setWindowHighlighted: (v: boolean) => void
  setTotalWindowCount: (n: number) => void
}

export const createWindowSlice: StateCreator<RootStore, [['zustand/immer', never]], [], WindowSlice> = (set) => ({
  windowId: null,
  isMainWindow: false,
  windowName: 'Main Window',
  windowColor: '#6366f1',
  windowHighlighted: false,
  totalWindowCount: 1,
  setWindowId: (id) =>
    set((state) => {
      state.windowId = id
    }),
  setIsMainWindow: (v) =>
    set((state) => {
      state.isMainWindow = v
    }),
  setWindowMeta: (name, color) =>
    set((state) => {
      state.windowName = name
      state.windowColor = color
    }),
  setWindowHighlighted: (v) =>
    set((state) => {
      state.windowHighlighted = v
    }),
  setTotalWindowCount: (n) =>
    set((state) => {
      state.totalWindowCount = n
    }),
})
