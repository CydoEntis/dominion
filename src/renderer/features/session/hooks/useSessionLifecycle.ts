import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { useStore } from '../../../store/root.store'
import { listSessions } from '../session.service'
import { getWindowId } from '../../window/window.service'
import { loadLayout } from '../persistence.service'
import type { PersistedLayout, SessionMeta, SessionExitPayload, WindowInitialSessionsPayload, TabReattachedPayload } from '@shared/ipc-types'

export function useSessionLifecycle(): void {
  const upsertSession = useStore((s) => s.upsertSession)
  const markSessionExited = useStore((s) => s.markSessionExited)
  const addTab = useStore((s) => s.addTab)
  const removePaneBySessionId = useStore((s) => s.removePaneBySessionId)
  const setWindowId = useStore((s) => s.setWindowId)
  const loadSettings = useStore((s) => s.loadSettings)
  const setPendingRestore = useStore((s) => s.setPendingRestore)
  const setIsMainWindow = useStore((s) => s.setIsMainWindow)

  const layoutRef = useRef<PersistedLayout | null | 'loading'>('loading')
  const isMainRef = useRef<boolean | null>(null)
  // Tracks running sessions found at startup — 'pending' until listSessions resolves
  const liveSessionsRef = useRef<SessionMeta[] | 'pending'>('pending')

  useEffect(() => {
    loadSettings()
    getWindowId().then(setWindowId)

    const maybeShowRestore = (): void => {
      // Wait for all three async sources to resolve before deciding
      if (layoutRef.current === 'loading' || isMainRef.current === null || liveSessionsRef.current === 'pending') return
      const live = liveSessionsRef.current as SessionMeta[]
      // If PTY sessions are already running (renderer reload / HMR), skip restore.
      // We already called addTab for them above so tabs are wired up.
      if (live.length > 0) return
      if (isMainRef.current && layoutRef.current && layoutRef.current.tabs.length > 0) {
        setPendingRestore(layoutRef.current)
      }
    }

    listSessions().then((sessions) => {
      const running = sessions.filter((m) => m.status === 'running')
      sessions.forEach((meta) => upsertSession(meta))
      liveSessionsRef.current = running
      // Wire up tabs for already-running sessions without layout restore
      running.forEach((m) => addTab(m.sessionId))
      maybeShowRestore()
    })

    loadLayout().then((layout) => {
      layoutRef.current = layout
      maybeShowRestore()
    })

    const offInitial = ipc.on(IPC.WINDOW_INITIAL_SESSIONS, (payload) => {
      const { sessionIds, windowId } = payload as WindowInitialSessionsPayload
      setWindowId(windowId)
      sessionIds.forEach((sessionId) => addTab(sessionId))
      isMainRef.current = sessionIds.length === 0
      setIsMainWindow(isMainRef.current)
      maybeShowRestore()
    })

    const offMeta = ipc.on(IPC.SESSION_META_UPDATE, (payload) => {
      const meta = payload as SessionMeta
      // Agent status toasts disabled — detection unreliable, revisit in roadmap
      upsertSession(meta)
    })

    const offExit = ipc.on(IPC.SESSION_EXIT, (payload) => {
      const { sessionId, exitCode } = payload as SessionExitPayload
      markSessionExited(sessionId, exitCode)
      removePaneBySessionId(sessionId)
      const sessionName = useStore.getState().sessions[sessionId]?.name ?? 'Session'
      if (exitCode === 0) {
        toast.success(`${sessionName} finished`)
      } else {
        toast.error(`${sessionName} exited (code ${exitCode})`)
      }
    })

    const offReattached = ipc.on(IPC.WINDOW_TAB_REATTACHED, (payload) => {
      const { sessionId } = payload as TabReattachedPayload
      addTab(sessionId)
    })

    return () => {
      offInitial()
      offMeta()
      offExit()
      offReattached()
    }
  }, [])
}
