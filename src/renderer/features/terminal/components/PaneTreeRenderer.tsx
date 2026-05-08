import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TerminalPane } from './TerminalPane'
import { useStore } from '../../../store/root.store'
import { createSession, killSession, patchSession } from '../../session/session.service'
import { detachTab, reattachTab } from '../../window/window.service'
import type { PaneNode } from '../pane-tree'

interface Props {
  node: PaneNode
  tabId: string
  onContextMenu?: (e: React.MouseEvent, sessionId: string, tabId: string) => void
  /** Override isMainWindow from store — useful in contexts where store value may be stale */
  forceMainWindow?: boolean
  /** Called when the last pane in this tree is closed */
  onCloseLastPane?: () => void
}

export function PaneTreeRenderer({ node, tabId, onContextMenu, forceMainWindow, onCloseLastPane }: Props): JSX.Element {
  const isMainWindow = forceMainWindow ?? useStore((s) => s.isMainWindow)
  const windowId = useStore((s) => s.windowId)
  const setFocusedSession = useStore((s) => s.setFocusedSession)

  if (node.type === 'leaf') {
    const sid = node.sessionId
    const paneItems = [
      {
        label: 'Split Horizontal',
        action: async () => {
          const parent = useStore.getState().sessions[sid]
          const groupId = parent?.groupId ?? tabId
          if (!parent?.groupId) patchSession({ sessionId: sid, groupId }).catch(() => {})
          const m = await createSession({ name: `${parent?.name ?? 'pane'} split`, cwd: parent?.cwd, groupId, cols: 80, rows: 24 })
          useStore.getState().splitPane(tabId, sid, 'horizontal', m)
        },
      },
      {
        label: 'Split Vertical',
        action: async () => {
          const parent = useStore.getState().sessions[sid]
          const groupId = parent?.groupId ?? tabId
          if (!parent?.groupId) patchSession({ sessionId: sid, groupId }).catch(() => {})
          const m = await createSession({ name: `${parent?.name ?? 'pane'} split`, cwd: parent?.cwd, groupId, cols: 80, rows: 24 })
          useStore.getState().splitPane(tabId, sid, 'vertical', m)
        },
      },
      isMainWindow
        ? {
            label: 'Detach to Window',
            action: async () => {
              useStore.getState().detachPane(tabId, sid)
              if (windowId) await detachTab(sid, windowId)
            },
          }
        : {
            label: 'Reattach to Main',
            action: async () => { await reattachTab(sid, windowId ?? undefined) },
          },
      {
        label: 'Close Pane',
        action: async () => {
          await killSession(sid)
          const { closePane, paneTree } = useStore.getState()
          const treeBeforeClose = paneTree[tabId]
          closePane(tabId, sid)
          // If this was the last pane, notify parent
          const isLastPane = treeBeforeClose?.type === 'leaf'
          if (isLastPane) onCloseLastPane?.()
        },
      },
    ]

    return (
      <div className="flex flex-col w-full h-full" onMouseDown={() => setFocusedSession(sid)}>
        <TerminalPane sessionId={sid} paneItems={paneItems} />
      </div>
    )
  }

  const handleClass =
    node.direction === 'vertical'
      ? 'h-1 bg-brand-panel hover:bg-brand-accent transition-colors cursor-row-resize flex-shrink-0'
      : 'w-1 bg-brand-panel hover:bg-brand-accent transition-colors cursor-col-resize flex-shrink-0'

  return (
    <PanelGroup orientation={node.direction} className="w-full h-full">
      {node.children.map((child, idx) => [
        idx > 0 && <PanelResizeHandle key={`handle-${node.id}-${idx}`} className={handleClass} />,
        <Panel key={child.type === 'leaf' ? child.sessionId : child.id} defaultSize={Math.floor(100 / node.children.length)} minSize={10}>
          <PaneTreeRenderer
            node={child}
            tabId={tabId}
            onContextMenu={onContextMenu}
            forceMainWindow={forceMainWindow}
            onCloseLastPane={onCloseLastPane}
          />
        </Panel>,
      ])}
    </PanelGroup>
  )
}
