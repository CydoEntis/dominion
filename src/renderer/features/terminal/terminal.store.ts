import type { StateCreator } from 'zustand'
import type { RootStore } from '../../store/root.store'

export interface TerminalInfo {
  cols: number
  rows: number
  ready: boolean
}

export interface TerminalSlice {
  mountedTerminals: Record<string, TerminalInfo>
  touchedFiles: Record<string, string[]>
  touchedFilePatches: Record<string, Record<string, string>>
  terminalThemes: Record<string, string>

  registerTerminal: (sessionId: string, cols: number, rows: number) => void
  unregisterTerminal: (sessionId: string) => void
  setTerminalReady: (sessionId: string, ready: boolean) => void
  addTouchedFile: (sessionId: string, filePath: string) => void
  appendTouchedFilePatch: (sessionId: string, filePath: string, patch: string) => void
  clearTouchedFiles: (sessionId: string) => void
  setTerminalTheme: (sessionId: string, themeId: string) => void
}

export const createTerminalSlice: StateCreator<RootStore, [['zustand/immer', never]], [], TerminalSlice> = (set) => ({
  mountedTerminals: {},
  touchedFiles: {},
  touchedFilePatches: {},
  terminalThemes: {},

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
    }),

  addTouchedFile: (sessionId, filePath) =>
    set((state) => {
      const current = state.touchedFiles[sessionId] ?? []
      const filtered = current.filter((p) => p !== filePath)
      state.touchedFiles[sessionId] = [filePath, ...filtered].slice(0, 10)
    }),

  appendTouchedFilePatch: (sessionId, filePath, patch) =>
    set((state) => {
      if (!state.touchedFilePatches[sessionId]) state.touchedFilePatches[sessionId] = {}
      const existing = state.touchedFilePatches[sessionId][filePath] ?? ''
      state.touchedFilePatches[sessionId][filePath] = existing ? `${existing}\n${patch}` : patch
    }),

  clearTouchedFiles: (sessionId) =>
    set((state) => {
      delete state.touchedFiles[sessionId]
      delete state.touchedFilePatches[sessionId]
    }),

  setTerminalTheme: (sessionId, themeId) =>
    set((state) => {
      state.terminalThemes[sessionId] = themeId
    }),
})
