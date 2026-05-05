import { useState, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { replayRequest, writeToSession, resizeSession } from '../../session/session.service'
import { openExternal } from '../../fs/fs.service'
import { useStore } from '../../../store/root.store'
import type { SessionDataPayload } from '@shared/ipc-types'

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/
const FILE_PATH_RE = /([A-Za-z]:[/\\][^\s"'<>]+|(?:^|\s)(\/[^\s"'<>]+))/

export interface TerminalCtxItem {
  label: string
  action: () => void
}

export interface TerminalCtxMenu {
  x: number
  y: number
  items: TerminalCtxItem[]
}

export function useTerminal(sessionId: string, containerRef: React.RefObject<HTMLDivElement>): {
  ctxMenu: TerminalCtxMenu | null
  dismissCtxMenu: () => void
} {
  const settings = useStore((s) => s.settings)
  const registerTerminal = useStore((s) => s.registerTerminal)
  const unregisterTerminal = useStore((s) => s.unregisterTerminal)
  const setTerminalReady = useStore((s) => s.setTerminalReady)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [ctxMenu, setCtxMenu] = useState<TerminalCtxMenu | null>(null)

  const dismissCtxMenu = (): void => setCtxMenu(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const terminal = new Terminal({
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        black: '#18181b',
        brightBlack: '#3f3f46',
        red: '#ef4444',
        brightRed: '#f87171',
        green: '#22c55e',
        brightGreen: '#4ade80',
        yellow: '#eab308',
        brightYellow: '#facc15',
        blue: '#3b82f6',
        brightBlue: '#60a5fa',
        magenta: '#a855f7',
        brightMagenta: '#c084fc',
        cyan: '#06b6d4',
        brightCyan: '#22d3ee',
        white: '#d4d4d8',
        brightWhite: '#fafafa'
      },
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    // Double-RAF: first frame starts layout, second frame has real dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fitAddon.fit()
      terminal.focus()
    }))

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const { cols, rows } = terminal
    registerTerminal(sessionId, cols, rows)

    // Ctrl+Shift+V → paste; Ctrl+C → copy selection if non-empty, otherwise SIGINT
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => terminal.paste(text)).catch(() => {})
        return false
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'c' && e.type === 'keydown') {
        const sel = terminal.getSelection()
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {})
          return false
        }
      }
      return true
    })

    terminal.onData((data) => { writeToSession({ sessionId, data }) })
    terminal.onResize(({ cols, rows }) => { resizeSession({ sessionId, cols, rows }) })

    replayRequest(sessionId).then(({ chunks }) => {
      chunks.forEach((chunk) => terminal.write(chunk))
      setTerminalReady(sessionId, true)
    })

    const offData = ipc.on(IPC.SESSION_DATA, (payload) => {
      const { sessionId: sid, data } = payload as SessionDataPayload
      if (sid === sessionId) terminal.write(data)
    })

    // Shift+click: open URL or file path from current selection
    const handleMouseDown = (e: MouseEvent): void => {
      if (!e.shiftKey) return
      const sel = terminal.getSelection().trim()
      if (!sel) return
      const urlMatch = sel.match(URL_RE)
      if (urlMatch) {
        e.preventDefault()
        openExternal(urlMatch[0]).catch(() => {})
        return
      }
      const fileMatch = sel.match(FILE_PATH_RE)
      if (fileMatch) {
        e.preventDefault()
        const path = (fileMatch[1] ?? fileMatch[2] ?? '').trim()
        if (path) document.dispatchEvent(new CustomEvent('acc:open-file', { detail: { path } }))
      }
    }

    // Right-click: show context menu with Copy / Open URL / Open File / Paste
    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      const sel = terminal.getSelection().trim()
      const items: TerminalCtxItem[] = []

      if (sel) {
        items.push({ label: 'Copy', action: () => navigator.clipboard.writeText(sel).catch(() => {}) })
        const urlMatch = sel.match(URL_RE)
        if (urlMatch) {
          const url = urlMatch[0]
          items.push({ label: 'Open URL', action: () => openExternal(url).catch(() => {}) })
        }
        const fileMatch = sel.match(FILE_PATH_RE)
        if (fileMatch) {
          const path = (fileMatch[1] ?? fileMatch[2] ?? '').trim()
          if (path) items.push({ label: 'Open File', action: () => {
            document.dispatchEvent(new CustomEvent('acc:open-file', { detail: { path } }))
          }})
        }
      }

      items.push({ label: 'Paste', action: () => {
        navigator.clipboard.readText().then((t) => terminal.paste(t)).catch(() => {})
      }})

      setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('contextmenu', handleContextMenu)

    // Resize observer — skip zero-dimension entries (fired when parent gets display:none)
    let rafId = 0
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!fitAddonRef.current) return
        const entry = entries[0]
        if (entry && (entry.contentRect.width === 0 || entry.contentRect.height === 0)) return
        try { fitAddonRef.current.fit() } catch {}
      })
    })

    // Re-fit when pane becomes visible again (e.g. switching back from projects view)
    const visibilityObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && fitAddonRef.current) {
        requestAnimationFrame(() => { try { fitAddonRef.current?.fit() } catch {} })
      }
    })

    observer.observe(container)
    visibilityObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      offData()
      observer.disconnect()
      visibilityObserver.disconnect()
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('contextmenu', handleContextMenu)
      terminal.dispose()
      unregisterTerminal(sessionId)
    }
  }, [sessionId])

  // Re-fit and re-focus when this pane becomes active
  useEffect(() => {
    if (activeSessionId === sessionId && terminalRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        terminalRef.current?.focus()
      })
    }
  }, [activeSessionId, sessionId])

  // Update font settings when they change (without remounting)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = settings.fontSize
      terminalRef.current.options.fontFamily = settings.fontFamily
      fitAddonRef.current?.fit()
    }
  }, [settings.fontSize, settings.fontFamily])

  return { ctxMenu, dismissCtxMenu }
}
