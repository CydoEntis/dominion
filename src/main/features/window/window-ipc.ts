import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DetachTabPayload, WindowControlAction } from '@shared/ipc-types'
import { detachTab, reattachTab, getWindow, focusWindow } from '../../window-manager'

export function registerWindowIpc(): void {
  ipcMain.handle(IPC.WINDOW_GET_ID, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return { windowId: win ? String(win.id) : null }
  })

  ipcMain.handle(IPC.WINDOW_DETACH_TAB, (event, payload: DetachTabPayload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : payload.fromWindowId
    const newWindowId = detachTab(payload.sessionId, fromWindowId)
    return { newWindowId }
  })

  ipcMain.handle(IPC.WINDOW_REATTACH_TAB, (event, payload: { sessionId: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : ''
    const success = reattachTab(payload.sessionId, fromWindowId)
    return { success }
  })

  ipcMain.on(IPC.WINDOW_CONTROL, (event, action: WindowControlAction) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === 'close') win.close()
  })

  ipcMain.handle(IPC.DIALOG_PICK_FOLDER, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_PICK_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
