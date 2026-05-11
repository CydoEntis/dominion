import { ipcMain, screen, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { detachTab, moveTabToWindow, getWindow } from '../../window-manager'

interface ActiveDrag {
  sessionId: string
  fromWindowId: string
}

let activeDrag: ActiveDrag | null = null
let hoveredWindowId: string | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let outsideAllWindowsCount = 0
let lastOutsideCursor = { x: 0, y: 0 }

// Number of 50ms polls outside all windows before auto-detaching (~300ms)
const OUTSIDE_DETACH_THRESHOLD = 6

function clearHover(): void {
  if (hoveredWindowId) {
    getWindow(hoveredWindowId)?.webContents.send(IPC.DRAG_HOVER_LEAVE)
    hoveredWindowId = null
  }
}

function stopPolling(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  clearHover()
  outsideAllWindowsCount = 0
}

function triggerDetach(drag: ActiveDrag, cursorPos: { x: number; y: number }): void {
  stopPolling()
  activeDrag = null
  detachTab(drag.sessionId, drag.fromWindowId, cursorPos)
  getWindow(drag.fromWindowId)?.webContents.send(IPC.WINDOW_SESSION_REMOVED, { sessionId: drag.sessionId })
}

export function registerDragIpc(): void {
  ipcMain.handle(IPC.DRAG_SESSION_START, (event, payload: { sessionId: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const fromWindowId = win ? String(win.id) : null
    if (!fromWindowId) return

    stopPolling()
    activeDrag = { sessionId: payload.sessionId, fromWindowId }
    outsideAllWindowsCount = 0

    pollInterval = setInterval(() => {
      const drag = activeDrag
      if (!drag) { stopPolling(); return }

      const cursor = screen.getCursorScreenPoint()
      const wins = BrowserWindow.getAllWindows()

      // Find which window the cursor is in (raw, before filtering)
      let rawFound: string | null = null
      for (const w of wins) {
        const b = w.getBounds()
        if (cursor.x >= b.x && cursor.x < b.x + b.width && cursor.y >= b.y && cursor.y < b.y + b.height) {
          rawFound = String(w.id)
          break
        }
      }

      const isOverSource = rawFound === drag.fromWindowId
      const isOverOtherWindow = rawFound !== null && rawFound !== drag.fromWindowId
      const isOutsideAll = rawFound === null

      if (isOutsideAll) {
        outsideAllWindowsCount++
        lastOutsideCursor = cursor
        clearHover()
        if (outsideAllWindowsCount >= OUTSIDE_DETACH_THRESHOLD) {
          triggerDetach(drag, lastOutsideCursor)
        }
      } else if (isOverSource) {
        outsideAllWindowsCount = 0
        clearHover()
      } else if (isOverOtherWindow) {
        outsideAllWindowsCount = 0
        if (rawFound !== hoveredWindowId) {
          clearHover()
          getWindow(rawFound!)?.webContents.send(IPC.DRAG_HOVER_ENTER, { sessionId: drag.sessionId })
          hoveredWindowId = rawFound
        }
      }
    }, 50)
  })

  ipcMain.handle(IPC.DRAG_SESSION_END, () => {
    const drag = activeDrag
    if (!drag) return

    const targetWindowId = hoveredWindowId
    const outsideCount = outsideAllWindowsCount
    const outsideCursor = { ...lastOutsideCursor }

    stopPolling()
    activeDrag = null

    if (targetWindowId) {
      moveTabToWindow(drag.sessionId, drag.fromWindowId, targetWindowId)
    } else if (outsideCount > 0) {
      // Cursor was outside at some point — dragend fired before the auto-detach timer
      detachTab(drag.sessionId, drag.fromWindowId, outsideCursor)
      getWindow(drag.fromWindowId)?.webContents.send(IPC.WINDOW_SESSION_REMOVED, { sessionId: drag.sessionId })
    }
    // else: cursor over source window the whole time — within-window reorder, renderer handles it
  })
}
