import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { replayRequest, writeToSession, resizeSession } from '../session/session.service'
import { useStore } from '../../store/root.store'
import type { SessionDataPayload } from '@shared/ipc-types'

export function useTerminal(sessionId: string, containerRef: React.RefObject<HTMLDivElement>): void {
  const settings = useStore((s) => s.settings)
  const registerTerminal = useStore((s) => s.registerTerminal)
  const unregisterTerminal = useStore((s) => s.unregisterTerminal)
  const setTerminalReady = useStore((s) => s.setTerminalReady)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

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
    terminal.open(containerRef.current)
    // Double-RAF: first frame starts layout, second frame has real dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fitAddon.fit()
      terminal.focus()
    }))

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const { cols, rows } = terminal
    registerTerminal(sessionId, cols, rows)

    // Forward keystrokes to PTY
    terminal.onData((data) => {
      writeToSession({ sessionId, data })
    })

    // Forward resize to PTY
    terminal.onResize(({ cols, rows }) => {
      resizeSession({ sessionId, cols, rows })
    })

    // Replay scrollback then subscribe to live data
    replayRequest(sessionId).then(({ chunks }) => {
      chunks.forEach((chunk) => terminal.write(chunk))
      setTerminalReady(sessionId, true)
    })

    // Listen for live session data
    const offData = ipc.on(IPC.SESSION_DATA, (payload) => {
      const { sessionId: sid, data } = payload as SessionDataPayload
      if (sid === sessionId) {
        terminal.write(data)
      }
    })

    // Resize observer — defer fit until after layout settles
    let rafId = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit()
          } catch {
            // ignore if terminal is disposed
          }
        }
      })
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      cancelAnimationFrame(rafId)
      offData()
      observer.disconnect()
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
}
