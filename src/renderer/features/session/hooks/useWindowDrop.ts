import { useState, useEffect } from 'react'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { useStore } from '../../../store/root.store'
import type { SessionMeta } from '@shared/ipc-types'

export function useWindowDrop(): { isDropTarget: boolean; dropSessionMeta: SessionMeta | null } {
  const sessions = useStore((s) => s.sessions)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [dropSessionId, setDropSessionId] = useState<string | null>(null)

  useEffect(() => {
    const offEnter = ipc.on(IPC.DRAG_HOVER_ENTER, (payload) => {
      const { sessionId } = payload as { sessionId: string }
      setIsDropTarget(true)
      setDropSessionId(sessionId)
    })
    const offLeave = ipc.on(IPC.DRAG_HOVER_LEAVE, () => {
      setIsDropTarget(false)
      setDropSessionId(null)
    })
    return () => { offEnter(); offLeave() }
  }, [])

  const dropSessionMeta = dropSessionId ? (sessions[dropSessionId] ?? null) : null

  return { isDropTarget, dropSessionMeta }
}
