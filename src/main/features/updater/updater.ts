import { ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipc-channels'

function broadcast(channel: string, payload?: unknown): void {
  const { BrowserWindow } = require('electron')
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

// Cached so renderers that mount after the event still get notified
let pendingUpdate: { version: string } | null = null

export function initUpdater(): void {
  if (!require('electron').app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    broadcast(IPC.UPDATE_AVAILABLE, { version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdate = { version: info.version }
    broadcast(IPC.UPDATE_DOWNLOADED, pendingUpdate)
  })

  ipcMain.handle(IPC.UPDATE_GET_PENDING, () => pendingUpdate)

  ipcMain.handle(IPC.UPDATE_INSTALL, () => {
    // isSilent=true: skip NSIS confirmation prompt
    // isForceRunAfter=true: relaunch after install even if launched silently
    autoUpdater.quitAndInstall(true, true)
  })

  autoUpdater.checkForUpdates().catch(() => {})
}
