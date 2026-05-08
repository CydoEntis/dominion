import { useCallback } from 'react'
import { PaneTreeRenderer } from '../../terminal/components/PaneTreeRenderer'
import { useStore } from '../../../store/root.store'
import { removeWorktree } from '../../fs/fs.service'

interface Props {
  sessionId: string
  onSessionClose?: () => void
}

export function AgentMonitorLayout({ sessionId, onSessionClose }: Props): JSX.Element {
  const paneTree = useStore((s) => s.paneTree[sessionId] ?? null)

  const handleCloseLastPane = useCallback(() => {
    const session = useStore.getState().sessions[sessionId]
    if (session?.worktreePath && session?.projectRoot) {
      removeWorktree(session.projectRoot, session.worktreePath).catch(() => {})
    }
    onSessionClose?.()
  }, [sessionId, onSessionClose])

  if (!paneTree) return <div className="flex-1 min-h-0" />

  return (
    <PaneTreeRenderer
      node={paneTree}
      tabId={sessionId}
      forceMainWindow={true}
      onCloseLastPane={handleCloseLastPane}
    />
  )
}
