import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'

// Set Windows taskbar app ID so the icon shows correctly
if (process.platform === 'win32') {
  app.setAppUserModelId('Dominion')
}
import { IPC } from '@shared/ipc-channels'
import type { WindowInitialSessionsPayload } from '@shared/ipc-types'
import { unsubscribeWebContents } from './features/session/session-registry'
import { getSession } from './features/session/session-registry'

const windows = new Map<string, BrowserWindow>()
let windowCounter = 0
let mainWindowId: string | null = null

function getWindowId(win: BrowserWindow): string {
  return String(win.id)
}

export function createWindow(initialSessionIds: string[] = []): BrowserWindow {
  windowCounter++

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'logo.png')
    : join(process.cwd(), 'logo.png')

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  windows.set(getWindowId(win), win)
  if (initialSessionIds.length === 0 && mainWindowId === null) {
    mainWindowId = getWindowId(win)
  }

  // Subscribe new window to its initial sessions
  win.webContents.on('did-finish-load', () => {
    const windowId = getWindowId(win)

    // Subscribe webContents to each session
    for (const sessionId of initialSessionIds) {
      const entry = getSession(sessionId)
      if (entry) {
        entry.pty.subscribe(win.webContents.id)
      }
    }

    const payload: WindowInitialSessionsPayload = {
      sessionIds: initialSessionIds,
      windowId
    }
    win.webContents.send(IPC.WINDOW_INITIAL_SESSIONS, payload)
  })

  // Capture id before 'closed' fires — webContents is destroyed by then
  const webContentsId = win.webContents.id
  const thisWindowId = getWindowId(win)
  win.on('closed', () => {
    windows.delete(thisWindowId)
    if (mainWindowId === thisWindowId) mainWindowId = null
    unsubscribeWebContents(webContentsId)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function getWindow(windowId: string): BrowserWindow | undefined {
  return windows.get(windowId)
}

export function focusWindow(windowId: string): boolean {
  const win = windows.get(windowId)
  if (!win) return false
  if (win.isMinimized()) win.restore()
  win.focus()
  return true
}

export function detachTab(sessionId: string, fromWindowId: string): string {
  const fromWin = windows.get(fromWindowId)
  if (fromWin) {
    const entry = getSession(sessionId)
    if (entry) {
      entry.pty.unsubscribe(fromWin.webContents.id)
    }
  }

  const newWin = createWindow([sessionId])
  return getWindowId(newWin)
}

export function reattachTab(sessionId: string, fromWindowId: string): boolean {
  if (!mainWindowId) return false
  const mainWin = windows.get(mainWindowId)
  if (!mainWin) return false

  const fromWin = windows.get(fromWindowId)
  const entry = getSession(sessionId)
  if (entry) {
    if (fromWin) entry.pty.unsubscribe(fromWin.webContents.id)
    entry.pty.subscribe(mainWin.webContents.id)
  }

  mainWin.webContents.send(IPC.WINDOW_TAB_REATTACHED, { sessionId })

  if (fromWin && fromWindowId !== mainWindowId) {
    fromWin.close()
  }

  return true
}
