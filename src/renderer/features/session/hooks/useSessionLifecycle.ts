import { useEffect, useRef } from 'react'
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

  // Refs let both async paths (loadLayout + initial-sessions) coordinate
  // regardless of which resolves first
  const layoutRef = useRef<PersistedLayout | null | 'loading'>('loading')
  const isMainRef = useRef<boolean | null>(null)

  useEffect(() => {
    loadSettings()
    getWindowId().then(setWindowId)

    listSessions().then((sessions) => {
      sessions.forEach((meta) => upsertSession(meta))
    })

    const maybeShowRestore = (): void => {
      if (layoutRef.current === 'loading' || isMainRef.current === null) return
      if (isMainRef.current && layoutRef.current && layoutRef.current.tabs.length > 0) {
        setPendingRestore(layoutRef.current)
      }
    }

    // Load layout eagerly — don't wait for initial-sessions
    loadLayout().then((layout) => {
      layoutRef.current = layout
      maybeShowRestore()
    })

    const offInitial = ipc.on(IPC.WINDOW_INITIAL_SESSIONS, (payload) => {
      const { sessionIds, windowId } = payload as WindowInitialSessionsPayload
      setWindowId(windowId)
      sessionIds.forEach((sessionId) => addTab(sessionId))

      // Detached windows receive their session up-front; main window gets none
      isMainRef.current = sessionIds.length === 0
      setIsMainWindow(isMainRef.current)
      maybeShowRestore()
    })

    const offMeta = ipc.on(IPC.SESSION_META_UPDATE, (payload) => {
      const meta = payload as SessionMeta
      upsertSession(meta)
    })

    const offExit = ipc.on(IPC.SESSION_EXIT, (payload) => {
      const { sessionId, exitCode } = payload as SessionExitPayload
      markSessionExited(sessionId, exitCode)
      removePaneBySessionId(sessionId)
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
