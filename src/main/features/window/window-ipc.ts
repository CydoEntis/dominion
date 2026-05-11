import { ipcMain, BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { DetachTabPayload, DetachNotePreviewPayload, WindowControlAction } from '@shared/ipc-types'
import { detachTab, detachNotePreview, detachNotePane, reattachNotePaneToMain, moveNotePaneToWindow, reattachTab, moveTabToWindow, findWindowForSession, getWindowList, getWindow, focusWindow, openSettingsWindow, highlightWindow, setWindowMeta, isMainWindow } from '../../window-manager'

export function registerWindowIpc(): void {
  ipcMain.handle(IPC.WINDOW_GET_ID, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const windowId = win ? String(win.id) : null
    return { windowId, isMainWindow: windowId ? isMainWindow(windowId) : false }
  })

  ipcMain.handle(IPC.WINDOW_DETACH_TAB, (event, payload: DetachTabPayload) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : payload.fromWindowId
    const newWindowId = detachTab(payload.sessionId, fromWindowId)
    return { newWindowId }
  })

  ipcMain.handle(IPC.WINDOW_DETACH_NOTE_PREVIEW, (_event, payload: DetachNotePreviewPayload) => {
    const newWindowId = detachNotePreview(payload.noteId)
    return { newWindowId }
  })

  ipcMain.handle(IPC.WINDOW_DETACH_NOTE_PANE, (event, payload: { noteId: string; panel: 'notes' | 'markdown-preview' }) => {
    const newWindowId = detachNotePane(payload.noteId, payload.panel)
    return { newWindowId }
  })

  ipcMain.handle(IPC.WINDOW_REATTACH_NOTE_PANE, (event, payload: { noteId: string; panel: 'notes' | 'markdown-preview' }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : ''
    reattachNotePaneToMain(payload.noteId, payload.panel, fromWindowId)
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_MOVE_NOTE_PANE, (event, payload: { noteId: string; panel: 'notes' | 'markdown-preview'; targetWindowId: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : ''
    moveNotePaneToWindow(payload.noteId, payload.panel, fromWindowId, payload.targetWindowId)
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_REATTACH_TAB, (event, payload: { sessionId: string; fromWindowId?: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : (payload.fromWindowId ?? '')
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

  ipcMain.handle(IPC.WINDOW_OPEN_SETTINGS, () => {
    openSettingsWindow()
  })

  ipcMain.handle(IPC.WINDOW_LIST, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const currentWindowId = win ? String(win.id) : undefined
    return getWindowList(currentWindowId)
  })

  ipcMain.handle(IPC.WINDOW_MOVE_TO_WINDOW, (event, payload: { sessionId: string; targetWindowId: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : null
    if (!fromWindowId) return { ok: false }
    moveTabToWindow(payload.sessionId, fromWindowId, payload.targetWindowId)
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_HIGHLIGHT, (_event, payload: { targetWindowId: string; active: boolean }) => {
    highlightWindow(payload.targetWindowId, payload.active)
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_SET_META, (event, payload: { name: string; color: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const windowId = win ? String(win.id) : null
    if (!windowId) return { ok: false }
    setWindowMeta(windowId, payload.name, payload.color)
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_MOVE_SESSION_ALONGSIDE, (event, payload: { sessionId: string; targetSessionId: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : null
    if (!fromWindowId) return { ok: false }
    const targetWindowId = findWindowForSession(payload.targetSessionId)
    if (!targetWindowId) return { ok: false }
    moveTabToWindow(payload.sessionId, fromWindowId, targetWindowId)
    return { ok: true }
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
