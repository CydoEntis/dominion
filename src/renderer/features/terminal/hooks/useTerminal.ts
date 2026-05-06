import { useState, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { replayRequest, writeToSession, resizeSession } from '../../session/session.service'
import { openExternal, readClipboard } from '../../fs/fs.service'
import { useStore } from '../../../store/root.store'
import type { SessionDataPayload } from '@shared/ipc-types'

const TOOL_FILE_RE = /●\s+(?:Edit|Write|Update)\(([^)\n]+)\)/
const DIFF_LINE_RE = /^\s{2,}(\d+) ([+\- ])(.*)$/
const DIFF_SUMMARY_RE = /[└⎿─]|Added\s+\d+|Removed\s+\d+|Modified\s+\d+/

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '').replace(/\r/g, '')
}

function resolveFilePath(raw: string, cwd: string): string {
  return /^([A-Za-z]:[/\\]|\/)/.test(raw)
    ? raw.replace(/\\/g, '/')
    : `${cwd}/${raw}`.replace(/\\/g, '/').replace(/\/+/g, '/')
}

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
  const addTouchedFile = useStore((s) => s.addTouchedFile)
  const appendTouchedFilePatch = useStore((s) => s.appendTouchedFilePatch)

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
        background: '#0f1117',
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
        readClipboard().then((text) => { terminal.paste(text); terminal.focus() }).catch(() => {})
        return false
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'c' && e.type === 'keydown') {
        const sel = terminal.getSelection()
        if (sel) {
          navigator.clipboard.writeText(sel).then(() => terminal.focus()).catch(() => {})
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

    // Per-chunk line buffer + active capture state (lives in closure across chunks)
    let lineBuffer = ''
    let capture: { filePath: string; lines: string[] } | null = null

    const finalizeCapture = (): void => {
      if (capture && capture.lines.length > 0) {
        appendTouchedFilePatch(sessionId, capture.filePath, capture.lines.join('\n'))
      }
      capture = null
    }

    const offData = ipc.on(IPC.SESSION_DATA, (payload) => {
      const { sessionId: sid, data } = payload as SessionDataPayload
      if (sid !== sessionId) return
      terminal.write(data)

      const text = lineBuffer + stripAnsi(data)
      const parts = text.split('\n')
      lineBuffer = parts.pop() ?? ''

      for (const line of parts) {
        const toolMatch = line.match(TOOL_FILE_RE)
        if (toolMatch) {
          finalizeCapture()
          const raw = toolMatch[1].trim()
          const cwd = useStore.getState().sessions[sessionId]?.cwd ?? ''
          const fullPath = resolveFilePath(raw, cwd)
          addTouchedFile(sessionId, fullPath)
          capture = { filePath: fullPath, lines: [] }
          continue
        }
        if (capture) {
          if (DIFF_LINE_RE.test(line) || DIFF_SUMMARY_RE.test(line)) {
            capture.lines.push(line)
          } else if (line.trim()) {
            finalizeCapture()
          }
        }
      }
    })

    // Track the last non-empty selection so Shift+mouseup can read it after xterm finalizes it
    let lastSel = ''
    terminal.onSelectionChange(() => {
      const s = terminal.getSelection()
      if (s) lastSel = s
    })

    // Shift+click: open URL or file path from current selection
    const handleMouseUp = (e: MouseEvent): void => {
      if (!e.shiftKey) return
      const sel = lastSel.trim()
      if (!sel) return
      const urlMatch = sel.match(URL_RE)
      if (urlMatch) {
        e.preventDefault()
        openExternal(urlMatch[0]).catch(() => {})
        lastSel = ''
        return
      }
      const fileMatch = sel.match(FILE_PATH_RE)
      if (fileMatch) {
        e.preventDefault()
        const path = (fileMatch[1] ?? fileMatch[2] ?? '').trim()
        if (path) document.dispatchEvent(new CustomEvent('acc:open-file', { detail: { path } }))
        lastSel = ''
      }
    }

    // Right-click: show context menu with Copy / Open URL / Paste
    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const sel = terminal.getSelection().trim()
      const x = e.clientX
      const y = e.clientY

      navigator.clipboard.readText().catch(() => '').then((clipText) => {
        const items: TerminalCtxItem[] = []

        if (sel) {
          items.push({ label: 'Copy', action: () => { navigator.clipboard.writeText(sel).catch(() => {}); terminal.focus() } })
          const urlMatch = sel.match(URL_RE)
          if (urlMatch) {
            const url = urlMatch[0]
            items.push({ label: 'Open URL', action: () => openExternal(url).catch(() => {}) })
          }
        }

        if (clipText) {
          items.push({ label: 'Paste', action: () => { terminal.paste(clipText); terminal.focus() } })
        }

        setCtxMenu({ x, y, items })
      })
    }

    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('contextmenu', handleContextMenu)

    const safeRefit = (): void => {
      try {
        fitAddonRef.current?.fit()
        // Force full re-render to clear any rendering artifacts from rapid resize
        if (terminalRef.current) {
          terminalRef.current.refresh(0, terminalRef.current.rows - 1)
        }
      } catch {}
    }

    // Resize observer — skip zero-dimension entries (fired when parent gets display:none)
    let rafId = 0
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const entry = entries[0]
        if (entry && (entry.contentRect.width === 0 || entry.contentRect.height === 0)) return
        safeRefit()
      })
    })

    // Re-fit when pane becomes visible again (e.g. switching back from projects view)
    const visibilityObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        requestAnimationFrame(safeRefit)
      }
    })

    observer.observe(container)
    visibilityObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      offData()
      observer.disconnect()
      visibilityObserver.disconnect()
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('contextmenu', handleContextMenu)
      terminal.dispose()
      unregisterTerminal(sessionId)
    }
  }, [sessionId])

  // Re-fit and re-focus when this pane becomes active
  useEffect(() => {
    if (activeSessionId === sessionId && terminalRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit()
          terminalRef.current?.refresh(0, (terminalRef.current?.rows ?? 1) - 1)
          terminalRef.current?.focus()
        } catch {}
      })
    }
  }, [activeSessionId, sessionId])

  // Update font settings when they change (without remounting)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = settings.fontSize
      terminalRef.current.options.fontFamily = settings.fontFamily
      try {
        fitAddonRef.current?.fit()
        terminalRef.current.refresh(0, terminalRef.current.rows - 1)
      } catch {}
    }
  }, [settings.fontSize, settings.fontFamily])

  return { ctxMenu, dismissCtxMenu }
}
