import { app } from 'electron'
app.setName('Shepherd')
import { createWindow } from './window-manager'
import { registerSessionIpc } from './features/session/session-ipc'
import { registerWindowIpc } from './features/window/window-ipc'
import { registerSettingsIpc } from './features/settings/settings-ipc'
import { registerPersistenceIpc } from './features/persistence/persistence-ipc'
import { registerFsIpc } from './features/fs/fs-ipc'
import { initUpdater } from './features/updater/updater'

function registerAllIpc(): void {
  registerSessionIpc()
  registerWindowIpc()
  registerSettingsIpc()
  registerPersistenceIpc()
  registerFsIpc()
}

app.whenReady().then(() => {
  registerAllIpc()
  createWindow()
  initUpdater()

  app.on('activate', () => {
    const { BrowserWindow } = require('electron')
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
