import { useStore } from '../../../store/root.store'
import { createSession, killSession, patchSession } from '../session.service'
import { detachTab, reattachTab } from '../../window/window.service'
import { DEFAULT_COLS, DEFAULT_ROWS } from '@shared/constants'

interface ContextMenuTarget {
  x: number
  y: number
  sessionId: string
  tabId: string
}

export interface UsePaneActionsReturn {
  handleSplitH: () => Promise<void>
  handleSplitV: () => Promise<void>
  handleDetach: () => Promise<void>
  handleReattach: () => Promise<void>
  handleClosePane: () => void
  handleKillSession: () => Promise<void>
}

export function usePaneActions(contextMenu: ContextMenuTarget | null): UsePaneActionsReturn {
  const sessions = useStore((s) => s.sessions)
  const windowId = useStore((s) => s.windowId)
  const splitPane = useStore((s) => s.splitPane)
  const closePane = useStore((s) => s.closePane)
  const detachPane = useStore((s) => s.detachPane)

  const handleSplit = async (direction: 'horizontal' | 'vertical'): Promise<void> => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    const parent = sessions[sessionId]
    const groupId = parent?.groupId ?? tabId
    if (!parent?.groupId) patchSession({ sessionId, groupId }).catch(() => {})
    const newMeta = await createSession({ name: `${parent?.name ?? 'pane'} split`, cwd: parent?.cwd, groupId, cols: DEFAULT_COLS, rows: DEFAULT_ROWS })
    splitPane(tabId, sessionId, direction, newMeta)
  }

  const handleSplitH = (): Promise<void> => handleSplit('horizontal')
  const handleSplitV = (): Promise<void> => handleSplit('vertical')

  const handleDetach = async (): Promise<void> => {
    if (!contextMenu || !windowId) return
    const { tabId, sessionId } = contextMenu
    detachPane(tabId, sessionId)
    await detachTab(sessionId, windowId)
  }

  const handleReattach = async (): Promise<void> => {
    if (!contextMenu) return
    await reattachTab(contextMenu.sessionId)
  }

  const handleClosePane = (): void => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    detachPane(tabId, sessionId)
  }

  const handleKillSession = async (): Promise<void> => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    await killSession(sessionId)
    closePane(tabId, sessionId)
  }

  return { handleSplitH, handleSplitV, handleDetach, handleReattach, handleClosePane, handleKillSession }
}
