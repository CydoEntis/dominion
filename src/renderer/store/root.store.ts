import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createSessionSlice, type SessionSlice } from '../features/session/session.store'
import { createTerminalSlice, type TerminalSlice } from '../features/terminal/terminal.store'
import { createWindowSlice, type WindowSlice } from '../features/window/window.store'
import { createSettingsSlice, type SettingsSlice } from '../features/settings/settings.store'

export type RootStore = SessionSlice & TerminalSlice & WindowSlice & SettingsSlice

export const useStore = create<RootStore>()(
  immer((...a) => ({
    ...createSessionSlice(...a),
    ...createTerminalSlice(...a),
    ...createWindowSlice(...a),
    ...createSettingsSlice(...a)
  }))
)
