import { useEffect, useRef, useState, useCallback } from 'react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { TitleBar } from './components/TitleBar'
import { EmptyState } from './components/EmptyState'
import { TerminalPane } from './features/terminal/TerminalPane'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { PaneContextMenu } from './components/PaneContextMenu'
import { SessionDashboard } from './components/SessionDashboard'
import { ActivityBar } from './components/ActivityBar'
import { CommandPalette } from './components/CommandPalette'
import { FileViewer } from './components/FileViewer'
import { useSessionLifecycle } from './features/session/useSessionLifecycle'
import { useLayoutPersistence } from './features/session/useLayoutPersistence'
import { useStore } from './store/root.store'
import { killSession, createSession } from './features/session/session.service'
import { detachTab, reattachTab } from './features/window/window.service'
import { clearLayout } from './features/session/persistence.service'
import { cn } from './lib/utils'
import { collectSessionIds } from './features/terminal/pane-tree'
import type { PaneNode } from './features/terminal/pane-tree'
import type { SessionMeta, PersistedLayout } from '@shared/ipc-types'

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
        <span
          className="text-[10px] text-zinc-600 truncate ml-auto flex-shrink-0 max-w-[40%]"
          title={meta.cwd}
        >
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
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(e, node.sessionId, tabId)
        }}
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
        idx > 0 && (
          <PanelResizeHandle key={`handle-${node.id}-${idx}`} className={handleClass} />
        ),
        <Panel
          key={child.type === 'leaf' ? child.sessionId : child.id}
          defaultSize={Math.floor(100 / node.children.length)}
          minSize={10}
        >
          <PaneTreeRenderer node={child} tabId={tabId} onContextMenu={onContextMenu} />
        </Panel>
      ])}
    </PanelGroup>
  )
}

function remapPaneTree(node: PaneNode, idMap: Map<string, string>): PaneNode {
  if (node.type === 'leaf') {
    return { type: 'leaf', sessionId: idMap.get(node.sessionId) ?? node.sessionId }
  }
  return { ...node, children: node.children.map((c) => remapPaneTree(c, idMap)) }
}

function firstLeafId(node: PaneNode): string {
  if (node.type === 'leaf') return node.sessionId
  return firstLeafId(node.children[0])
}

export function App(): JSX.Element {
  useSessionLifecycle()
  useLayoutPersistence()

  const activeSessionId = useStore((s) => s.activeSessionId)
  const tabOrder = useStore((s) => s.tabOrder)
  const sessions = useStore((s) => s.sessions)
  const paneTree = useStore((s) => s.paneTree)
  const windowId = useStore((s) => s.windowId)
  const isMainWindow = useStore((s) => s.isMainWindow)
  const isDashboardOpen = useStore((s) => s.isDashboardOpen)
  const removeTab = useStore((s) => s.removeTab)
  const splitPane = useStore((s) => s.splitPane)
  const closePane = useStore((s) => s.closePane)
  const detachPane = useStore((s) => s.detachPane)
  const pendingRestore = useStore((s) => s.pendingRestore)
  const setPendingRestore = useStore((s) => s.setPendingRestore)
  const upsertSession = useStore((s) => s.upsertSession)
  const restoreTab = useStore((s) => s.restoreTab)

  const settings = useStore((s) => s.settings)

  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'projects'>('sessions')
  const [openFiles, setOpenFiles] = useState<Array<{ path: string; root: string; hasChanges: boolean }>>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  const handleFileClick = useCallback((path: string, xy: string | undefined): void => {
    const root = useStore.getState().settings.projectRoot
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev
      return [...prev, { path, root, hasChanges: xy !== undefined }]
    })
    setActiveFilePath(path)
  }, [])

  const activeSessionIdRef = useRef(activeSessionId)
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const match = (e: KeyboardEvent, binding: string): boolean => {
      const parts = binding.toLowerCase().split('+').map((p) => p.trim())
      const key = parts[parts.length - 1]
      return (
        e.key.toLowerCase() === key &&
        e.ctrlKey === parts.includes('ctrl') &&
        e.shiftKey === parts.includes('shift') &&
        e.altKey === parts.includes('alt')
      )
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      const hk = settingsRef.current.hotkeys
      if (match(e, hk.newSession)) {
        e.preventDefault(); e.stopPropagation()
        document.dispatchEvent(new CustomEvent('acc:new-session'))
      } else if (e.ctrlKey && e.key.toLowerCase() === 'o' && !e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation()
        document.dispatchEvent(new CustomEvent('acc:open-project'))
      } else if (match(e, hk.closeSession)) {
        e.preventDefault(); e.stopPropagation()
        const sid = activeSessionIdRef.current
        if (sid) { killSession(sid); removeTab(sid) }
      } else if (match(e, hk.commandPalette)) {
        e.preventDefault(); e.stopPropagation()
        setPaletteOpen((v) => !v)
      } else if (match(e, hk.toggleDashboard)) {
        e.preventDefault(); e.stopPropagation()
        useStore.getState().toggleDashboard()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [removeTab])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, sessionId: string, tabId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, sessionId, tabId })
    },
    []
  )

  const handleSplitH = async (): Promise<void> => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    const newMeta = await createSession({
      name: `${sessions[sessionId]?.name ?? 'pane'} split`,
      cols: 80,
      rows: 24
    })
    splitPane(tabId, sessionId, 'horizontal', newMeta)
  }

  const handleSplitV = async (): Promise<void> => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    const newMeta = await createSession({
      name: `${sessions[sessionId]?.name ?? 'pane'} split`,
      cols: 80,
      rows: 24
    })
    splitPane(tabId, sessionId, 'vertical', newMeta)
  }

  const handleDetach = async (): Promise<void> => {
    if (!contextMenu || !windowId) return
    const { tabId, sessionId } = contextMenu
    detachPane(tabId, sessionId)
    await detachTab(sessionId, windowId)
  }

  const handleReattach = async (): Promise<void> => {
    if (!contextMenu) return
    const { sessionId } = contextMenu
    await reattachTab(sessionId)
  }

  const handleClose = async (): Promise<void> => {
    if (!contextMenu) return
    const { tabId, sessionId } = contextMenu
    await killSession(sessionId)
    closePane(tabId, sessionId)
  }

  const handleRestore = async (layout: PersistedLayout): Promise<void> => {
    setPendingRestore(null)
    await clearLayout()

    const idMap = new Map<string, string>()
    const newMetas: SessionMeta[] = []
    for (const ps of layout.sessions) {
      let agentCommand = ps.agentCommand
      if (agentCommand === 'claude' && ps.conversationId) {
        agentCommand = `claude --resume ${ps.conversationId}`
      }
      try {
        const meta = await createSession({ name: ps.name, agentCommand, cwd: ps.cwd || undefined, cols: 80, rows: 24 })
        upsertSession(meta)
        idMap.set(ps.sessionId, meta.sessionId)
        newMetas.push(meta)
      } catch {
        // skip sessions that fail to restore
      }
    }

    for (const tab of layout.tabs) {
      const tree = tab.tree as PaneNode
      if (!tree) continue
      const newTabId = idMap.get(firstLeafId(tree))
      if (!newTabId) continue

      if (tab.detached) {
        await detachTab(newTabId, windowId ?? '')
      } else {
        const remapped = remapPaneTree(tree, idMap)
        const tabSessionIds = new Set(collectSessionIds(remapped))
        const tabMetas = newMetas.filter((m) => tabSessionIds.has(m.sessionId))
        restoreTab(newTabId, remapped, tabMetas)
      }
    }
  }

  // ── Auto-restore: trigger silently when layout is available ───────────────
  const handleRestoreRef = useRef(handleRestore)
  useEffect(() => { handleRestoreRef.current = handleRestore })

  useEffect(() => {
    if (pendingRestore) {
      handleRestoreRef.current(pendingRestore)
    }
  }, [pendingRestore])

  const handleActivityChange = (next: 'sessions' | 'projects'): void => {
    if (next === sidebarTab && isDashboardOpen) {
      useStore.getState().toggleDashboard()
    } else {
      if (!isDashboardOpen) useStore.getState().toggleDashboard()
      setSidebarTab(next)
    }
  }

  const handleCloseFile = (path: string): void => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path))
    setActiveFilePath((cur) => {
      if (cur !== path) return cur
      const remaining = openFiles.filter((f) => f.path !== path)
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null
    })
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
          <SessionDashboard
            onFileClick={handleFileClick}
            activeTab={sidebarTab}
          />
        )}

        {/* terminals — always mounted to preserve xterm state, hidden in projects mode */}
        <div className={cn('flex-1 min-h-0 relative', (isDashboardOpen && sidebarTab === 'projects') ? 'hidden' : 'flex flex-col')}>
          {tabOrder.length === 0 && <EmptyState />}
          {tabOrder.map((tabId) => {
            const tree = paneTree[tabId]
            const isActive = activeSessionId === tabId
            return (
              <div
                key={tabId}
                className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'}`}
              >
                {tree && (
                  <PaneTreeRenderer
                    node={tree}
                    tabId={tabId}
                    onContextMenu={handleContextMenu}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* file viewer — shown when projects panel active */}
        {isDashboardOpen && sidebarTab === 'projects' && (
          <div className="flex-1 min-h-0">
            <FileViewer
              files={openFiles}
              activeFilePath={activeFilePath}
              onActivate={setActiveFilePath}
              onClose={handleCloseFile}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between h-6 px-3 bg-brand-surface border-t border-brand-panel flex-shrink-0">
        <span className="text-xs text-zinc-500">
          {tabOrder.length === 0
            ? 'No sessions'
            : `${tabOrder.length} session${tabOrder.length !== 1 ? 's' : ''}`}
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
          isMainWindow={isMainWindow}
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
