import { useState, useCallback, useRef } from 'react'
import { Toaster } from 'sonner'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/TabBar'
import { EmptyState } from './components/EmptyState'
import { TerminalPane } from './features/terminal/components/TerminalPane'
import { SettingsDialog } from './features/settings/components/SettingsDialog'
import { PaneContextMenu } from './features/session/components/PaneContextMenu'
import { SessionDashboard } from './features/session/components/SessionDashboard'
import { ActivityBar } from './components/ActivityBar'
import { CommandPalette } from './components/CommandPalette'
import { FileViewer, VIEWER_THEMES } from './features/fs/components/FileViewer'
import type { FilePaneTab } from './features/fs/hooks/useFilePane'
import { defaultTab } from './features/fs/hooks/useFilePane'
import { useSessionLifecycle } from './features/session/hooks/useSessionLifecycle'
import { useLayoutPersistence } from './features/session/hooks/useLayoutPersistence'
import { useLayoutRestore } from './features/session/hooks/useLayoutRestore'
import { useKeyboardShortcuts } from './features/session/hooks/useKeyboardShortcuts'
import { usePaneActions } from './features/session/hooks/usePaneActions'
import { useFileTabs } from './features/session/hooks/useFileTabs'
import { useStore } from './store/root.store'
import { cn } from './lib/utils'
import { Kbd } from './components/Kbd'
import type { PaneNode } from './features/terminal/pane-tree'

interface ContextMenuTarget {
  x: number
  y: number
  sessionId: string
  tabId: string
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
  const [refreshTick, setRefreshTick] = useState(0)
  const [fileViewTab, setFileViewTab] = useState<FilePaneTab>('content')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth }
    const onMove = (ev: MouseEvent): void => {
      if (!sidebarDragRef.current) return
      const next = Math.max(160, Math.min(480, sidebarDragRef.current.startWidth + ev.clientX - sidebarDragRef.current.startX))
      setSidebarWidth(next)
    }
    const onUp = (): void => {
      sidebarDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])
  const updateSettings = useStore((s) => s.updateSettings)
  const fileViewerTheme = useStore((s) => s.settings.fileViewerTheme)
  const commandPaletteHotkey = useStore((s) => s.settings.hotkeys.commandPalette)

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

  const sessions = useStore((s) => s.sessions)
  const activeMeta = activeSessionId ? sessions[activeSessionId] : null
  const titleBarTitle = sidebarTab === 'sessions'
    ? (activeMeta?.name ?? 'No session')
    : (activeFilePath ? activeFilePath.replace(/\\/g, '/').split('/').pop() ?? activeFilePath : 'Projects')
  const titleBarSubtitle = sidebarTab === 'sessions'
    ? (activeMeta?.cwd ?? '')
    : (activeFilePath ? activeFilePath.replace(/\\/g, '/') : '')

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-zinc-100 overflow-hidden dark">
      <TitleBar title={titleBarTitle} subtitle={titleBarSubtitle} />

      <div className="flex flex-1 min-h-0">
        <ActivityBar activity={sidebarTab} panelOpen={isDashboardOpen} onChange={handleActivityChange} />

        {isDashboardOpen && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col h-full">
              <SessionDashboard
                onFileClick={handleFileClick}
                activeTab={sidebarTab}
                activeFilePath={activeFilePath}
                externalRefreshTick={refreshTick}
                onSwitchToSessions={() => setSidebarTab('sessions')}
              />
            </div>
            <div
              className="w-1 flex-shrink-0 bg-brand-panel hover:bg-brand-green transition-colors cursor-col-resize"
              onMouseDown={handleSidebarDragStart}
            />
          </>
        )}

        {/* Sessions content — tab bar + pane area */}
        <div className={cn('flex-1 min-w-0 min-h-0', (isDashboardOpen && sidebarTab === 'projects') ? 'hidden' : 'flex flex-col')}>
          {tabOrder.length > 0 && (
            <TabBar
              activity="sessions"
              openFiles={openFiles}
              activeFilePath={activeFilePath}
              onActivateFile={setActiveFilePath}
              onCloseFile={handleCloseFile}
              onRefresh={() => setRefreshTick((t) => t + 1)}
            />
          )}
          <div className="flex-1 min-h-0 relative">
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
        </div>

        {/* Projects content — tab bar + file viewer */}
        {isDashboardOpen && sidebarTab === 'projects' && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {openFiles.length > 0 && (
              <TabBar
                activity="projects"
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                onActivateFile={setActiveFilePath}
                onCloseFile={handleCloseFile}
                onRefresh={() => setRefreshTick((t) => t + 1)}
              />
            )}
            <FileViewer files={openFiles} activeFilePath={activeFilePath} onActivate={setActiveFilePath} onClose={handleCloseFile} tab={fileViewTab} onTabChange={setFileViewTab} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between h-8 px-3 bg-brand-surface border-t border-brand-panel flex-shrink-0">
        <span className="text-xs text-zinc-500">
          {tabOrder.length === 0 ? 'No sessions' : `${tabOrder.length} session${tabOrder.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-1 h-full">
          {sidebarTab === 'projects' && activeFilePath && (() => {
            const activeFile = openFiles.find((f) => f.path === activeFilePath)
            const isMd = activeFilePath.replace(/\\/g, '/').split('/').pop()?.split('.').pop()?.toLowerCase() === 'md'
            const btnBase = 'inline-flex items-center px-2 h-5 text-[10px] rounded transition-colors'
            return (
              <>
                {isMd && (
                  <button onClick={() => setFileViewTab('preview')} className={cn(btnBase, fileViewTab === 'preview' ? 'bg-brand-panel text-brand-light' : 'text-zinc-600 hover:text-zinc-300')}>Preview</button>
                )}
                <button onClick={() => setFileViewTab('content')} className={cn(btnBase, fileViewTab === 'content' ? 'bg-brand-panel text-brand-light' : 'text-zinc-600 hover:text-zinc-300')}>Raw</button>
                {activeFile?.hasChanges && (
                  <button onClick={() => setFileViewTab('diff')} className={cn(btnBase, fileViewTab === 'diff' ? 'bg-brand-panel text-brand-light' : 'text-zinc-600 hover:text-zinc-300')}>Diff</button>
                )}
                <div className="w-px h-3 bg-brand-panel mx-1 flex-shrink-0" />
                <div className="relative flex items-center">
                  <button onClick={() => setShowThemePicker((v) => !v)} className={cn(btnBase, 'text-zinc-600 hover:text-zinc-300')}>Theme</button>
                  {showThemePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
                      <div className="absolute bottom-full right-0 mb-1 z-50 bg-brand-surface border border-brand-panel rounded shadow-xl py-1 min-w-[160px]">
                      {VIEWER_THEMES.map((t) => (
                        <button key={t.id} onClick={() => { updateSettings({ fileViewerTheme: t.id }); setShowThemePicker(false) }}
                          className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', t.id === fileViewerTheme ? 'text-brand-light bg-brand-panel' : 'text-zinc-300 hover:bg-brand-panel')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    </>
                  )}
                </div>
                <div className="w-px h-3 bg-brand-panel mx-1 flex-shrink-0" />
              </>
            )
          })()}
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
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  )
}
