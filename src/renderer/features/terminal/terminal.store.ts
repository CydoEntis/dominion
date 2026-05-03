import type { StateCreator } from 'zustand'
import type { RootStore } from '../../store/root.store'

export interface TerminalInfo {
  cols: number
  rows: number
  ready: boolean
}

export interface TerminalSlice {
  mountedTerminals: Record<string, TerminalInfo>

  registerTerminal: (sessionId: string, cols: number, rows: number) => void
  unregisterTerminal: (sessionId: string) => void
  setTerminalReady: (sessionId: string, ready: boolean) => void
}

export const createTerminalSlice: StateCreator<RootStore, [['zustand/immer', never]], [], TerminalSlice> = (set) => ({
  mountedTerminals: {},

  registerTerminal: (sessionId, cols, rows) =>
    set((state) => {
      state.mountedTerminals[sessionId] = { cols, rows, ready: false }
    }),

  unregisterTerminal: (sessionId) =>
    set((state) => {
      delete state.mountedTerminals[sessionId]
    }),

  setTerminalReady: (sessionId, ready) =>
    set((state) => {
      if (state.mountedTerminals[sessionId]) {
        state.mountedTerminals[sessionId].ready = ready
      }
    })
})
