import type { StateCreator } from 'zustand'
import type { AppSettings, Note } from '@shared/ipc-types'
import { DEFAULT_SETTINGS } from '@shared/ipc-types'
import type { RootStore } from '../../store/root.store'
import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'

export interface SettingsSlice {
  settings: AppSettings
  settingsLoaded: boolean
  notes: Note[]

  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  saveNote: (id: string, content: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  addNote: (id: string) => void
}

export const createSettingsSlice: StateCreator<RootStore, [['zustand/immer', never]], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  notes: [],

  loadSettings: async () => {
    const settings = (await ipc.invoke(IPC.SETTINGS_GET)) as AppSettings
    set((state) => {
      state.settings = settings
      state.settingsLoaded = true
    })
    const notes = (await ipc.invoke(IPC.NOTES_LOAD)) as Note[]
    set((state) => { state.notes = notes })
  },

  updateSettings: async (patch) => {
    const updated = (await ipc.invoke(IPC.SETTINGS_SET, patch)) as AppSettings
    set((state) => {
      state.settings = updated
    })
  },

  saveNote: async (id: string, content: string) => {
    set((state) => {
      const idx = state.notes.findIndex(n => n.id === id)
      if (idx !== -1) {
        state.notes[idx] = { ...state.notes[idx], content, updatedAt: Date.now() }
      }
    })
    await ipc.invoke(IPC.NOTES_SAVE, { id, content })
  },

  deleteNote: async (id: string) => {
    set((state) => { state.notes = state.notes.filter(n => n.id !== id) })
    await ipc.invoke(IPC.NOTES_DELETE, { id })
  },

  addNote: (id: string) => {
    set((state) => {
      state.notes.unshift({ id, content: '', updatedAt: Date.now() })
    })
  },
})
