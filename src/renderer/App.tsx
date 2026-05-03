import { useState, useCallback } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TitleBar } from './components/TitleBar'
import { EmptyState } from './components/EmptyState'
import { TerminalPane } from './features/terminal/components/TerminalPane'
import { SettingsDialog } from './features/settings/components/SettingsDialog'
import { PaneContextMenu } from './features/session/components/PaneContextMenu'
import { SessionDashboard } from './features/session/components/SessionDashboard'
import { ActivityBar } from './components/ActivityBar'
import { CommandPalette } from './components/CommandPalette'
import { FileViewer } from './features/fs/components/FileViewer'
import { useSessionLifecycle } from './features/session/hooks/useSessionLifecycle'
import { useLayoutPersistence } from './features/session/hooks/useLayoutPersistence'
import { useLayoutRestore } from './features/session/hooks/useLayoutRestore'
import { useKeyboardShortcuts } from './features/session/hooks/useKeyboardShortcuts'
import { usePaneActions } from './features/session/hooks/usePaneActions'
import { useFileTabs } from './features/session/hooks/useFileTabs'
import { useStore } from './store/root.store'
import { cn } from './lib/utils'
import type { SessionMeta } from '@shared/ipc-types'
import type { PaneNode } from './features/terminal/pane-tree'

interface ContextMenuTarget {
  x: number
  y: number
  sessionId: string
  tabId: string
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 2) return p.replace(/\\/g, '/')
  return `…/${parts.slice(-2).join('/')}`
}

function PaneHeader({ meta, isActive }: { meta: SessionMeta | undefined; isActive: boolean }): JSX.Element {
  const isRunning = meta?.status === 'running'
  return (
    <div className={cn(
      'flex items-center h-7 px-3 border-b border-l-2 flex-shrink-0 transition-colors gap-2',
      isActive
        ? 'bg-brand-panel/80 border-b-brand-panel border-l-brand-green'
        : 'bg-brand-surface border-b-brand-panel border-l-transparent'
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isRunning ? 'bg-green-400 animate-pulse' : 'bg-zinc-600')} />
      <span className={cn('text-xs font-medium truncate', isActive ? 'text-zinc-200' : 'text-zinc-500')}>
        {meta?.name ?? '…'}
      </span>
      {meta?.cwd && (
        <span className="text-[10px] text-zinc-600 truncate ml-auto flex-shrink-0 max-w-[40%]" title={meta.cwd}>
          {shortPath(meta.cwd)}
        </span>
      )}
    </div>
  )
}

function PaneTreeRenderer({
  node,
  tabId,
  onContextMenu
}: {
  node: PaneNode
  tabId: string
  onContextMenu: (e: React.MouseEvent, sessionId: string, tabId: string) => void
}): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const focusedSessionId = useStore((s) => s.focusedSessionId)
  const setFocusedSession = useStore((s) => s.setFocusedSession)

  if (node.type === 'leaf') {
    const isActive = focusedSessionId === node.sessionId
    return (
      <div
        className="flex flex-col w-full h-full"
        onMouseDown={() => setFocusedSession(node.sessionId)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node.sessionId, tabId) }}
      >
        <PaneHeader meta={sessions[node.sessionId]} isActive={isActive} />
        <TerminalPane sessionId={node.sessionId} />
      </div>
    )
  }

  const handleClass =
    node.direction === 'vertical'
      ? 'h-1 bg-brand-panel hover:bg-brand-green transition-colors cursor-row-resize flex-shrink-0'
      : 'w-1 bg-brand-panel hover:bg-brand-green transition-colors cursor-col-resize flex-shrink-0'

  return (
    <PanelGroup orientation={node.direction} className="w-full h-full">
      {node.children.map((child, idx) => [
        idx > 0 && <PanelResizeHandle key={`handle-${node.id}-${idx}`} className={handleClass} />,
        <Panel key={child.type === 'leaf' ? child.sessionId : child.id} defaultSize={Math.floor(100 / node.children.length)} minSize={10}>
          <PaneTreeRenderer node={child} tabId={tabId} onContextMenu={onContextMenu} />
        </Panel>
      ])}
    </PanelGroup>
  )
}

export function App(): JSX.Element {
  useSessionLifecycle()
  useLayoutPersistence()
  useLayoutRestore()

  const activeSessionId = useStore((s) => s.activeSessionId)
  const tabOrder = useStore((s) => s.tabOrder)
  const paneTree = useStore((s) => s.paneTree)
  const isDashboardOpen = useStore((s) => s.isDashboardOpen)

  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'projects'>('sessions')

  const { openFiles, activeFilePath, setActiveFilePath, handleFileClick, handleCloseFile } = useFileTabs()
  const { handleSplitH, handleSplitV, handleDetach, handleReattach, handleClose } = usePaneActions(contextMenu)

  useKeyboardShortcuts({ onTogglePalette: () => setPaletteOpen((v) => !v) })

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sessionId: string, tabId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, sessionId, tabId })
    },
    []
  )

  const handleActivityChange = (next: 'sessions' | 'projects'): void => {
    if (next === sidebarTab && isDashboardOpen) {
      useStore.getState().toggleDashboard()
    } else {
      if (!isDashboardOpen) useStore.getState().toggleDashboard()
      setSidebarTab(next)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-zinc-100 overflow-hidden dark">
      <TitleBar
        activity={sidebarTab}
        openFiles={openFiles}
        activeFilePath={activeFilePath}
        onActivateFile={setActiveFilePath}
        onCloseFile={handleCloseFile}
      />

      <div className="flex flex-1 min-h-0">
        <ActivityBar activity={sidebarTab} panelOpen={isDashboardOpen} onChange={handleActivityChange} />

        {isDashboardOpen && (
          <SessionDashboard onFileClick={handleFileClick} activeTab={sidebarTab} />
        )}

        <div className={cn('flex-1 min-h-0 relative', (isDashboardOpen && sidebarTab === 'projects') ? 'hidden' : 'flex flex-col')}>
          {tabOrder.length === 0 && <EmptyState />}
          {tabOrder.map((tabId) => {
            const tree = paneTree[tabId]
            const isActive = activeSessionId === tabId
            return (
              <div key={tabId} className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'}`}>
                {tree && <PaneTreeRenderer node={tree} tabId={tabId} onContextMenu={handleContextMenu} />}
              </div>
            )
          })}
        </div>

        {isDashboardOpen && sidebarTab === 'projects' && (
          <div className="flex-1 min-h-0">
            <FileViewer files={openFiles} activeFilePath={activeFilePath} onActivate={setActiveFilePath} onClose={handleCloseFile} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between h-6 px-3 bg-brand-surface border-t border-brand-panel flex-shrink-0">
        <span className="text-xs text-zinc-500">
          {tabOrder.length === 0 ? 'No sessions' : `${tabOrder.length} session${tabOrder.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600">Ctrl+P — palette</span>
          <SettingsDialog />
        </div>
      </div>

      {contextMenu && (
        <PaneContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isMainWindow={useStore.getState().isMainWindow}
          onDismiss={() => setContextMenu(null)}
          onSplitH={handleSplitH}
          onSplitV={handleSplitV}
          onDetach={handleDetach}
          onReattach={handleReattach}
          onClose={handleClose}
        />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
