import { BrowserWindow, shell, app, Menu } from 'electron'
import { join } from 'path'

// Set Windows taskbar app ID so the icon shows correctly
if (process.platform === 'win32') {
  app.setAppUserModelId('Orbit')
}
import { IPC } from '@shared/ipc-channels'
import type { WindowInitialSessionsPayload } from '@shared/ipc-types'
import { unsubscribeWebContents } from './features/session/session-registry'
import { getSession } from './features/session/session-registry'

const windows = new Map<string, BrowserWindow>()
const windowSessions = new Map<string, Set<string>>() // windowId → sessionIds it owns
const windowNotePanes = new Map<string, { noteId: string; panel: 'notes' | 'markdown-preview' }>()
const windowNames = new Map<string, string>()
const windowColors = new Map<string, string>()
const manuallyNamedWindows = new Set<string>() // windowIds the user has explicitly renamed
const loadedWindowIds = new Set<string>()      // windowIds whose did-finish-load has fired
let mainWindowId: string | null = null
let settingsWinId: string | null = null
let isQuitting = false
app.on('before-quit', () => { isQuitting = true })

const WINDOW_ACCENT_COLORS = ['#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4']

function getWindowId(win: BrowserWindow): string {
  return String(win.id)
}

function nextWindowLabel(): { name: string; color: string } {
  const usedColors = new Set<string>()
  for (const [id] of windowNames.entries()) {
    if (id !== mainWindowId) usedColors.add(windowColors.get(id) ?? '')
  }
  const color = WINDOW_ACCENT_COLORS.find((c) => !usedColors.has(c)) ?? WINDOW_ACCENT_COLORS[0]
  // Temporary name — resequenceWindowNames() will correct it after insertion
  return { name: `Window ?`, color }
}

function resequenceWindowNames(): void {
  const secondary = [...windows.keys()].filter((id) => id !== mainWindowId && id !== settingsWinId)
  let n = 1
  for (const id of secondary) {
    if (manuallyNamedWindows.has(id)) continue
    const newName = `Window ${n++}`
    windowNames.set(id, newName)
    if (loadedWindowIds.has(id)) {
      const win = windows.get(id)
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.WINDOW_META_UPDATED, { name: newName, color: windowColors.get(id) })
      }
    }
  }
}

export function createWindow(initialSessionIds: string[] = [], initialNoteId?: string, initialNotePaneInfo?: { noteId: string; panel: 'notes' | 'markdown-preview' }): BrowserWindow {
  Menu.setApplicationMenu(null)

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

  const winId = getWindowId(win)
  if (winId === mainWindowId) {
    windowNames.set(winId, 'Main Window')
    windowColors.set(winId, '#6366f1')
  } else {
    const label = nextWindowLabel()
    windowNames.set(winId, label.name)
    windowColors.set(winId, label.color)
    resequenceWindowNames() // assigns correct number and pushes to already-loaded windows
  }

  // Notify existing (already-loaded) windows of the new count
  broadcastWindowCount()

  // Subscribe new window to its initial sessions
  win.webContents.on('did-finish-load', () => {
    const windowId = getWindowId(win)
    loadedWindowIds.add(windowId)

    // Subscribe webContents to each session
    for (const sessionId of initialSessionIds) {
      const entry = getSession(sessionId)
      if (entry) {
        entry.pty.subscribe(win.webContents.id)
      }
    }

    const appWindowCount = [...windows.keys()].filter((id) => id !== settingsWinId).length
    const payload: WindowInitialSessionsPayload = {
      sessionIds: initialSessionIds,
      windowId,
      isMainWindow: windowId === mainWindowId,
      windowName: windowNames.get(windowId),
      windowColor: windowColors.get(windowId),
      totalWindowCount: appWindowCount,
    }
    win.webContents.send(IPC.WINDOW_INITIAL_SESSIONS, payload)
    if (initialNoteId) {
      win.webContents.send(IPC.WINDOW_INITIAL_NOTE_PREVIEW, { noteId: initialNoteId, windowId })
    }
    if (initialNotePaneInfo) {
      win.webContents.send(IPC.WINDOW_INITIAL_NOTE_PANE, initialNotePaneInfo)
    }
  })

  // Capture id before 'closed' fires — webContents is destroyed by then
  const webContentsId = win.webContents.id
  const thisWindowId = getWindowId(win)
  win.on('maximize', () => win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGE, { maximized: true }))
  win.on('unmaximize', () => win.webContents.send(IPC.WINDOW_MAXIMIZED_CHANGE, { maximized: false }))

  win.on('closed', () => {
    windows.delete(thisWindowId)
    windowNames.delete(thisWindowId)
    windowColors.delete(thisWindowId)
    manuallyNamedWindows.delete(thisWindowId)
    loadedWindowIds.delete(thisWindowId)
    if (mainWindowId === thisWindowId) mainWindowId = null
    unsubscribeWebContents(webContentsId)
    resequenceWindowNames()
    broadcastWindowCount()
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

export function focusMainWindow(): void {
  if (!mainWindowId) return
  focusWindow(mainWindowId)
}

export function detachTab(sessionId: string, fromWindowId: string, cursorPos?: { x: number; y: number }): string {
  const fromWin = windows.get(fromWindowId)
  if (fromWin) {
    const entry = getSession(sessionId)
    if (entry) entry.pty.unsubscribe(fromWin.webContents.id)
  }

  const newWin = createWindow([sessionId])
  const newWindowId = getWindowId(newWin)
  if (cursorPos) newWin.setPosition(cursorPos.x - 200, cursorPos.y - 20)
  windowSessions.set(newWindowId, new Set([sessionId]))

  newWin.on('closed', () => {
    const sessions = windowSessions.get(newWindowId) ?? new Set()
    windowSessions.delete(newWindowId)
    if (!mainWindowId) return
    const mainWin = windows.get(mainWindowId)
    if (!mainWin || mainWin.isDestroyed()) return
    for (const sid of sessions) {
      const e = getSession(sid)
      if (e) e.pty.subscribe(mainWin.webContents.id)
      mainWin.webContents.send(IPC.WINDOW_TAB_REATTACHED, { sessionId: sid })
    }
  })

  return newWindowId
}

export function moveTabToWindow(sessionId: string, fromWindowId: string, targetWindowId: string): void {
  if (fromWindowId === targetWindowId) return
  const fromWin = windows.get(fromWindowId)
  const targetWin = windows.get(targetWindowId)
  if (!targetWin || targetWin.isDestroyed()) return

  const entry = getSession(sessionId)
  if (entry) {
    if (fromWin) entry.pty.unsubscribe(fromWin.webContents.id)
    entry.pty.subscribe(targetWin.webContents.id)
  }

  windowSessions.get(fromWindowId)?.delete(sessionId)
  if (targetWindowId !== mainWindowId) {
    if (!windowSessions.has(targetWindowId)) windowSessions.set(targetWindowId, new Set())
    windowSessions.get(targetWindowId)!.add(sessionId)
  }

  targetWin.webContents.send(IPC.WINDOW_ADD_SESSION, { sessionId, meta: entry?.meta })

  const fromSessions = windowSessions.get(fromWindowId)
  if (fromWin) {
    if (fromWindowId !== mainWindowId && (fromSessions?.size ?? 0) === 0) {
      fromWin.close()
    } else {
      fromWin.webContents.send(IPC.WINDOW_SESSION_REMOVED, { sessionId })
    }
  }
}

export function openSettingsWindow(): void {
  if (settingsWinId) {
    const existing = windows.get(settingsWinId)
    if (existing && !existing.isDestroyed()) { existing.focus(); return }
  }

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'logo.png')
    : join(process.cwd(), 'logo.png')

  const win = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    frame: false,
    icon: iconPath,
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const id = String(win.id)
  settingsWinId = id
  windows.set(id, win)

  win.on('closed', () => {
    windows.delete(id)
    if (settingsWinId === id) settingsWinId = null
  })

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL + '#settings')
  } else {
    win.loadURL(`file://${join(__dirname, '../renderer/index.html')}#settings`)
  }
}

export function detachNotePreview(noteId: string): string {
  const newWin = createWindow([], noteId)
  return getWindowId(newWin)
}

export function detachNotePane(noteId: string, panel: 'notes' | 'markdown-preview'): string {
  const newWin = createWindow([], undefined, { noteId, panel })
  const newWindowId = getWindowId(newWin)
  windowNotePanes.set(newWindowId, { noteId, panel })
  newWin.on('closed', () => {
    if (isQuitting) return
    const pane = windowNotePanes.get(newWindowId)
    windowNotePanes.delete(newWindowId)
    if (!mainWindowId || !pane) return
    const mainWin = windows.get(mainWindowId)
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(IPC.WINDOW_NOTE_PANE_REATTACHED, pane)
  })
  return newWindowId
}

export function reattachNotePaneToMain(noteId: string, panel: 'notes' | 'markdown-preview', fromWindowId: string): void {
  if (!mainWindowId) return
  const mainWin = windows.get(mainWindowId)
  if (!mainWin || mainWin.isDestroyed()) return
  mainWin.webContents.send(IPC.WINDOW_NOTE_PANE_REATTACHED, { noteId, panel })
  windowNotePanes.delete(fromWindowId)
  const fromWin = windows.get(fromWindowId)
  if (fromWin && !fromWin.isDestroyed() && fromWindowId !== mainWindowId) fromWin.close()
}

export function moveNotePaneToWindow(noteId: string, panel: 'notes' | 'markdown-preview', fromWindowId: string, targetWindowId: string): void {
  if (fromWindowId === targetWindowId) return
  const targetWin = windows.get(targetWindowId)
  if (!targetWin || targetWin.isDestroyed()) return
  targetWin.webContents.send(IPC.WINDOW_ADD_NOTE_PANE, { noteId, panel })
  windowNotePanes.delete(fromWindowId)
  const fromWin = windows.get(fromWindowId)
  if (fromWin && !fromWin.isDestroyed()) {
    const fromSessionCount = windowSessions.get(fromWindowId)?.size ?? 0
    if (fromWindowId !== mainWindowId && fromSessionCount === 0) {
      fromWin.close()
    } else {
      fromWin.webContents.send(IPC.WINDOW_NOTE_PANE_REMOVED, { noteId, panel })
    }
  }
  if (targetWindowId !== mainWindowId) windowNotePanes.set(targetWindowId, { noteId, panel })
}

export function getWindowList(excludeWindowId?: string): { windowId: string; isMain: boolean; windowName: string; windowColor: string }[] {
  const result: { windowId: string; isMain: boolean; windowName: string; windowColor: string }[] = []
  for (const [windowId] of windows) {
    if (windowId === settingsWinId) continue
    if (windowId === excludeWindowId) continue
    result.push({
      windowId,
      isMain: windowId === mainWindowId,
      windowName: windowNames.get(windowId) ?? 'Window',
      windowColor: windowColors.get(windowId) ?? '#6366f1',
    })
  }
  return result
}

export function highlightWindow(targetWindowId: string, active: boolean): void {
  const win = windows.get(targetWindowId)
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC.WINDOW_HIGHLIGHT, { active })
}

function broadcastWindowCount(): void {
  const appWindowIds = [...windows.keys()].filter((id) => id !== settingsWinId)
  const count = appWindowIds.length
  for (const id of appWindowIds) {
    const win = windows.get(id)
    if (!win || win.isDestroyed()) continue
    win.webContents.send(IPC.WINDOW_COUNT_CHANGED, { count })
  }
}

export function setWindowMeta(windowId: string, name: string, color: string): void {
  if (!windows.has(windowId)) return
  windowNames.set(windowId, name)
  windowColors.set(windowId, color)
  manuallyNamedWindows.add(windowId)
}

export function isMainWindow(windowId: string): boolean {
  return windowId === mainWindowId
}

export function getWindowNotePanesList(): Array<{ noteId: string; panel: 'notes' | 'markdown-preview' }> {
  return [...windowNotePanes.values()]
}

export function findWindowForSession(sessionId: string): string | null {
  for (const [windowId, sessions] of windowSessions) {
    if (sessions.has(sessionId)) return windowId
  }
  return mainWindowId
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

  const winSessions = windowSessions.get(fromWindowId)
  if (winSessions) winSessions.delete(sessionId)

  mainWin.webContents.send(IPC.WINDOW_TAB_REATTACHED, { sessionId })

  if (fromWin && fromWindowId !== mainWindowId) {
    if ((winSessions?.size ?? 0) === 0) {
      fromWin.close()
    } else {
      fromWin.webContents.send(IPC.WINDOW_SESSION_REMOVED, { sessionId })
    }
  }

  return true
}
