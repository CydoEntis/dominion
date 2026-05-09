import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { EmptyState } from '../../../components/EmptyState'
import { TerminalPane } from './TerminalPane'
import { NotesPane } from '../../layout/components/NotesPane'
import { MarkdownPreviewPane } from '../../layout/components/MarkdownPreviewPane'
import { PaneDropTarget } from '../../layout/dnd/PaneDropTarget'
import { useStore } from '../../../store/root.store'
import { detachTab, reattachTab } from '../../window/window.service'
import type { LayoutNode } from '../../layout/layout-tree'

interface Props {
  node: LayoutNode
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
    if (node.panel === 'home') {
      return (
        <PaneDropTarget leafId={node.id} tabId={tabId}>
          <div className="w-full h-full flex items-center justify-center">
            <EmptyState />
          </div>
        </PaneDropTarget>
      )
    }

    if (node.panel === 'notes') {
      return (
        <PaneDropTarget leafId={node.id} tabId={tabId}>
          <div className="flex flex-col w-full h-full bg-brand-surface">
            <NotesPane tabId={tabId} leafId={node.id} initialNoteId={node.noteId} />
          </div>
        </PaneDropTarget>
      )
    }

    if (node.panel === 'markdown-preview') {
      return (
        <PaneDropTarget leafId={node.id} tabId={tabId}>
          <MarkdownPreviewPane
            tabId={tabId}
            leafId={node.id}
            noteId={node.noteId}
            isMainWindow={isMainWindow}
            windowId={windowId}
          />
        </PaneDropTarget>
      )
    }

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
        action: () => {
          const { detachPane, paneTree } = useStore.getState()
          const isLastPane = paneTree[tabId]?.type === 'leaf'
          detachPane(tabId, sid)
          if (isLastPane) onCloseLastPane?.()
        },
      },
    ]

    const isFocused = rootIsASplit && sid === focusedSessionId
    const sessionColor = sessions[sid]?.color ?? '#22c55e'

    return (
      <PaneDropTarget leafId={node.id} tabId={tabId}>
        <div
          className="flex flex-col w-full h-full"
          style={isFocused ? { boxShadow: `inset 0 0 0 2px ${sessionColor}, inset 0 3px 0 0 ${sessionColor}` } : undefined}
          onMouseDown={() => {
            setFocusedSession(sid)
            document.dispatchEvent(new CustomEvent('acc:terminal-pane-focused'))
          }}
        >
          <TerminalPane sessionId={sid} paneItems={paneItems} />
        </div>
      </PaneDropTarget>
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
        <Panel key={child.id} defaultSize={Math.floor(100 / node.children.length)} minSize={10}>
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
