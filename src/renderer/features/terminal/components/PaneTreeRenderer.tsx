import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TerminalPane } from './TerminalPane'
import { useStore } from '../../../store/root.store'
import { killSession } from '../../session/session.service'
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
  const focusedSessionId = useStore((s) => s.focusedSessionId)
  const sessions = useStore((s) => s.sessions)
  const rootIsASplit = useStore((s) => s.paneTree[tabId]?.type === 'split')

  if (node.type === 'leaf') {
    const sid = node.sessionId

    const paneItems = [
      {
        label: 'Split Horizontal',
        action: () => {
          document.dispatchEvent(new CustomEvent('acc:new-session-for-split', {
            detail: { tabId, sessionId: sid, direction: 'horizontal' }
          }))
        },
      },
      {
        label: 'Split Vertical',
        action: () => {
          document.dispatchEvent(new CustomEvent('acc:new-session-for-split', {
            detail: { tabId, sessionId: sid, direction: 'vertical' }
          }))
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
          const { closePane, removeTab, paneTree } = useStore.getState()
          removeTab(sid)  // remove from sessions store so EXIT handler skips the error toast
          const treeBeforeClose = paneTree[tabId]
          closePane(tabId, sid)
          const isLastPane = treeBeforeClose?.type === 'leaf'
          if (isLastPane) onCloseLastPane?.()
        },
      },
    ]

    const isFocused = rootIsASplit && sid === focusedSessionId
    const sessionColor = sessions[sid]?.color ?? '#22c55e'

    return (
      <div
        className="flex flex-col w-full h-full"
        style={isFocused ? { boxShadow: `inset 0 0 0 1px ${sessionColor}60, inset 0 2px 0 0 ${sessionColor}` } : undefined}
        onMouseDown={() => setFocusedSession(sid)}
      >
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
