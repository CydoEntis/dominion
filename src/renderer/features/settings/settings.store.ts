import type { StateCreator } from 'zustand'
import type { AppSettings } from '@shared/ipc-types'
import { DEFAULT_SETTINGS } from '@shared/ipc-types'
import type { RootStore } from '../../store/root.store'
import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'

export interface SettingsSlice {
  settings: AppSettings
  settingsLoaded: boolean

  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export const createSettingsSlice: StateCreator<RootStore, [['zustand/immer', never]], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,

  loadSettings: async () => {
    const settings = (await ipc.invoke(IPC.SETTINGS_GET)) as AppSettings
    set((state) => {
      state.settings = settings
      state.settingsLoaded = true
    })
  },

  updateSettings: async (patch) => {
    const updated = (await ipc.invoke(IPC.SETTINGS_SET, patch)) as AppSettings
    set((state) => {
      state.settings = updated
    })
  }
})
