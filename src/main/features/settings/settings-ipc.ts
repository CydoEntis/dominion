import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { AppSettingsSchema } from '@shared/ipc-types'
import { getSettings, setSettings } from './settings-store'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    return getSettings()
  })

  ipcMain.handle(IPC.SETTINGS_SET, (event, patch) => {
    const partial = AppSettingsSchema.partial().parse(patch)
    const merged = setSettings(partial)
    // Broadcast to all other windows so theme/settings stay in sync
    const senderId = event.sender.id
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== senderId && !win.isDestroyed()) {
        win.webContents.send(IPC.SETTINGS_UPDATED, merged)
      }
    }
    return merged
  })
}
