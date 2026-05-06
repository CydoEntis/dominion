import { useState, useCallback, useRef, useEffect } from 'react'
import { Toaster } from 'sonner'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/TabBar'
import { EmptyState } from './components/EmptyState'
import { TerminalPane } from './features/terminal/components/TerminalPane'
import { PaneContextMenu } from './features/session/components/PaneContextMenu'
import { SessionDashboard } from './features/session/components/SessionDashboard'
import { NotepadPane } from './components/NotepadPane'
import { NoteEditor } from './components/NoteEditor'
import { NoteDrawer } from './components/NoteDrawer'
import { ActivityBar } from './components/ActivityBar'
import { SettingsForm } from './features/settings/components/SettingsForm'
import { PresetsPanel } from './features/settings/components/PresetsPanel'
import { CommandPalette } from './components/CommandPalette'
import { FileSearchPalette } from './components/FileSearchPalette'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { FileViewer, VIEWER_THEMES } from './features/fs/components/FileViewer'
import type { FilePaneTab } from './features/fs/hooks/useFilePane'
import { createSession, killSession } from './features/session/session.service'
import { detachTab, reattachTab } from './features/window/window.service'
import { useSessionLifecycle } from './features/session/hooks/useSessionLifecycle'
import { useLayoutPersistence } from './features/session/hooks/useLayoutPersistence'
import { useLayoutRestore } from './features/session/hooks/useLayoutRestore'
import { useKeyboardShortcuts } from './features/session/hooks/useKeyboardShortcuts'
import { usePaneActions } from './features/session/hooks/usePaneActions'
import { useFileTabs } from './features/session/hooks/useFileTabs'
import { useAutoUpdater } from './features/updater/hooks/useAutoUpdater'
import { useStore } from './store/root.store'
import { cn } from './lib/utils'
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
    const sid = node.sessionId
    const splitPane = useStore.getState().splitPane
    const closePane = useStore.getState().closePane
    const detachPane = useStore.getState().detachPane
    const windowId = useStore.getState().windowId
    const paneItems = [
      { label: 'Split Horizontal', action: async () => { const m = await createSession({ name: `${useStore.getState().sessions[sid]?.name ?? 'pane'} split`, cols: 80, rows: 24 }); splitPane(tabId, sid, 'horizontal', m) } },
      { label: 'Split Vertical', action: async () => { const m = await createSession({ name: `${useStore.getState().sessions[sid]?.name ?? 'pane'} split`, cols: 80, rows: 24 }); splitPane(tabId, sid, 'vertical', m) } },
      { label: 'Detach to Window', action: async () => { detachPane(tabId, sid); if (windowId) await detachTab(sid, windowId) } },
      { label: 'Close Pane', action: async () => { await killSession(sid); closePane(tabId, sid) } },
    ]
    return (
      <div
        className="flex flex-col w-full h-full"
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
  useAutoUpdater()

  const activeSessionId = useStore((s) => s.activeSessionId)
  const tabOrder = useStore((s) => s.tabOrder)
  const paneTree = useStore((s) => s.paneTree)
  const isDashboardOpen = useStore((s) => s.isDashboardOpen)

  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [fileSearchOpen, setFileSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'projects' | 'notes' | 'presets' | 'settings'>('sessions')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false)
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

  const addNote = useStore((s) => s.addNote)
  const storeSaveNote = useStore((s) => s.saveNote)

  const createNote = useCallback((): string => {
    const id = crypto.randomUUID()
    addNote(id)
    storeSaveNote(id, '')
    return id
  }, [addNote, storeSaveNote])

  useKeyboardShortcuts({
    onTogglePalette: () => setPaletteOpen((v) => !v),
    onFileSearch: () => setFileSearchOpen((v) => !v),
    onShowShortcuts: () => setShortcutsOpen((v) => !v),
    onNewNote: useCallback(() => {
      const id = createNote()
      setActiveNoteId(id)
      if (!isDashboardOpen) useStore.getState().toggleDashboard()
      setSidebarTab('notes')
    }, [createNote, isDashboardOpen]),
    onNewNoteDrawer: useCallback(() => {
      const id = createNote()
      setActiveNoteId(id)
      setNoteDrawerOpen(true)
    }, [createNote]),
  })

  // Keep refs so the one-time effects below always see current values
  const sidebarTabRef = useRef(sidebarTab)
  const isDashboardOpenRef = useRef(isDashboardOpen)
  const openFilesRef = useRef(openFiles)
  const activeFilePathRef = useRef(activeFilePath)
  const handleFileClickRef = useRef(handleFileClick)
  useEffect(() => { sidebarTabRef.current = sidebarTab }, [sidebarTab])
  useEffect(() => { isDashboardOpenRef.current = isDashboardOpen }, [isDashboardOpen])
  useEffect(() => { openFilesRef.current = openFiles }, [openFiles])
  useEffect(() => { activeFilePathRef.current = activeFilePath }, [activeFilePath])
  useEffect(() => { handleFileClickRef.current = handleFileClick }, [handleFileClick])

  // Terminal → file viewer: open a file path dispatched from the terminal context menu
  useEffect(() => {
    const handler = (e: Event): void => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path
      if (!path) return
      if (!isDashboardOpenRef.current) useStore.getState().toggleDashboard()
      setSidebarTab('projects')
      handleFileClickRef.current(path, undefined)
    }
    document.addEventListener('acc:open-file', handler)
    return () => document.removeEventListener('acc:open-file', handler)
  }, [])

  // Note creation events dispatched by EmptyState and CommandPalette
  useEffect(() => {
    const handleNewNote = (): void => {
      const id = createNote()
      setActiveNoteId(id)
      if (!isDashboardOpenRef.current) useStore.getState().toggleDashboard()
      setSidebarTab('notes')
    }
    const handleQuickNote = (): void => {
      const id = createNote()
      setActiveNoteId(id)
      setNoteDrawerOpen(true)
    }
    document.addEventListener('acc:new-note', handleNewNote)
    document.addEventListener('acc:quick-note', handleQuickNote)
    return () => {
      document.removeEventListener('acc:new-note', handleNewNote)
      document.removeEventListener('acc:quick-note', handleQuickNote)
    }
  }, [createNote])

  // File viewer keybinds: Alt+R → raw, Alt+P → preview (md only), Alt+D → diff (changed files)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return
      if (sidebarTabRef.current !== 'projects' || !openFilesRef.current.length) return
      const path = activeFilePathRef.current
      const isMd = path?.replace(/\\/g, '/').split('/').pop()?.split('.').pop()?.toLowerCase() === 'md'
      const activeFile = openFilesRef.current.find((f) => f.path === path)
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault(); setFileViewTab('content')
      } else if ((e.key === 'p' || e.key === 'P') && isMd) {
        e.preventDefault(); setFileViewTab('preview')
      } else if ((e.key === 'd' || e.key === 'D') && activeFile?.hasChanges) {
        e.preventDefault(); setFileViewTab('diff')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sessionId: string, tabId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, sessionId, tabId })
    },
    []
  )

  const handleActivityChange = (next: 'sessions' | 'projects' | 'notes' | 'presets' | 'settings'): void => {
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
    : sidebarTab === 'notes'
      ? 'Notes'
      : sidebarTab === 'settings'
        ? 'Settings'
        : sidebarTab === 'presets'
          ? (activeMeta?.name ?? 'Presets')
          : (activeFilePath ? activeFilePath.replace(/\\/g, '/').split('/').pop() ?? activeFilePath : 'Projects')
  const titleBarSubtitle = sidebarTab === 'sessions'
    ? (activeMeta?.cwd ?? '')
    : sidebarTab === 'notes' || sidebarTab === 'settings'
      ? ''
      : (activeFilePath ? activeFilePath.replace(/\\/g, '/') : '')

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-zinc-100 overflow-hidden dark">
      <TitleBar title={titleBarTitle} subtitle={titleBarSubtitle} />

      <div className="flex flex-1 min-h-0">
        <ActivityBar activity={sidebarTab} panelOpen={isDashboardOpen} onChange={handleActivityChange} />

        {isDashboardOpen && sidebarTab !== 'settings' && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col h-full">
              {sidebarTab === 'notes' ? (
                <NotepadPane activeNoteId={activeNoteId} onActivate={setActiveNoteId} onCreate={() => { const id = createNote(); setActiveNoteId(id) }} />
              ) : sidebarTab === 'presets' ? (
                <PresetsPanel />
              ) : (
                <SessionDashboard
                  onFileClick={handleFileClick}
                  activeTab={sidebarTab}
                  activeFilePath={activeFilePath}
                  externalRefreshTick={refreshTick}
                  onSwitchToSessions={() => setSidebarTab('sessions')}
                />
              )}
            </div>
            <div
              className="w-1 flex-shrink-0 bg-brand-panel hover:bg-brand-accent transition-colors cursor-col-resize"
              onMouseDown={handleSidebarDragStart}
            />
          </>
        )}

        {/* Sessions content — pane area (no tab bar; sessions are managed from the sidebar) */}
        <div className={cn('flex-1 min-w-0 min-h-0', (isDashboardOpen && (sidebarTab === 'projects' || sidebarTab === 'notes' || sidebarTab === 'settings')) ? 'hidden' : 'flex flex-col')}>
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

        {/* Notes content — full editor */}
        {isDashboardOpen && sidebarTab === 'notes' && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <NoteEditor activeNoteId={activeNoteId} onActivate={setActiveNoteId} onCreate={() => { const id = createNote(); setActiveNoteId(id) }} />
          </div>
        )}

        {/* Settings content — full-width form */}
        {isDashboardOpen && sidebarTab === 'settings' && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <SettingsForm onClose={() => useStore.getState().toggleDashboard()} />
          </div>
        )}

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
                  <button onClick={() => setFileViewTab('preview')} className={cn(btnBase, fileViewTab === 'preview' ? 'bg-brand-panel text-brand-muted' : 'text-zinc-600 hover:text-zinc-300')}>Preview</button>
                )}
                <button onClick={() => setFileViewTab('content')} className={cn(btnBase, fileViewTab === 'content' ? 'bg-brand-panel text-brand-muted' : 'text-zinc-600 hover:text-zinc-300')}>Raw</button>
                {activeFile?.hasChanges && (
                  <button onClick={() => setFileViewTab('diff')} className={cn(btnBase, fileViewTab === 'diff' ? 'bg-brand-panel text-brand-muted' : 'text-zinc-600 hover:text-zinc-300')}>Diff</button>
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
                          className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', t.id === fileViewerTheme ? 'text-brand-muted bg-brand-panel' : 'text-zinc-300 hover:bg-brand-panel')}>
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

      <NoteDrawer open={noteDrawerOpen} onClose={() => setNoteDrawerOpen(false)} activeNoteId={activeNoteId} onCreate={() => { const id = createNote(); setActiveNoteId(id) }} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onShowShortcuts={() => { setPaletteOpen(false); setShortcutsOpen(true) }} />
      <FileSearchPalette open={fileSearchOpen} onClose={() => setFileSearchOpen(false)} onOpenFile={(path) => { if (!isDashboardOpen) useStore.getState().toggleDashboard(); setSidebarTab('projects'); handleFileClick(path, undefined) }} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  )
}
