import { useState, useCallback, useRef, useEffect } from 'react'
import { Toaster } from 'sonner'
import { NotebookPen, Settings, Moon, Sun, Monitor, Sparkles, GitBranch } from 'lucide-react'
import { createPortal } from 'react-dom'
import { TitleBar } from './components/TitleBar'
import { NoteDrawer } from './components/NoteDrawer'
import { PaneContextMenu } from './features/session/components/PaneContextMenu'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { SettingsForm } from './features/settings/components/SettingsForm'
import { EmptyState } from './components/EmptyState'
import { AgentMonitorSidebar } from './features/workspace/components/AgentMonitorSidebar'
import { AgentMonitorLayout } from './features/workspace/components/AgentMonitorLayout'
import { GitReviewPanel } from './features/workspace/components/GitReviewPanel'
import { useSessionLifecycle } from './features/session/hooks/useSessionLifecycle'
import { useLayoutPersistence } from './features/session/hooks/useLayoutPersistence'
import { useLayoutRestore } from './features/session/hooks/useLayoutRestore'
import { useKeyboardShortcuts } from './features/session/hooks/useKeyboardShortcuts'
import { usePaneActions } from './features/session/hooks/usePaneActions'
import { useAutoUpdater } from './features/updater/hooks/useAutoUpdater'
import { useGitReview } from './features/workspace/hooks/useGitReview'
import { useStore } from './store/root.store'
import { cn } from './lib/utils'

interface ContextMenuTarget {
  x: number
  y: number
  sessionId: string
  tabId: string
}

const THEMES = [
  { id: 'dark'   as const, label: 'Dark',   icon: Moon      },
  { id: 'light'  as const, label: 'Light',  icon: Sun       },
  { id: 'system' as const, label: 'System', icon: Monitor   },
  { id: 'space'  as const, label: 'Space',  icon: Sparkles  },
]

function StatusThemeToggle(): JSX.Element {
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ right: number; bottom: number }>({ right: 0, bottom: 32 })
  const CurrentIcon = THEMES.find((t) => t.id === theme)?.icon ?? Moon

  const handleOpen = (): void => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 4 })
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : handleOpen}
        title="Theme"
        className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded transition-colors', open ? 'text-brand-muted bg-brand-panel' : 'text-zinc-500 hover:text-zinc-300')}
      >
        <CurrentIcon size={15} />
        <span className="text-[11px] font-medium">Theme</span>
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-36"
            style={{ right: menuPos.right, bottom: menuPos.bottom }}
          >
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { updateSettings({ theme: id }); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left',
                  theme === id ? 'text-zinc-200 bg-brand-panel/40' : 'text-zinc-400 hover:bg-brand-panel hover:text-zinc-200'
                )}
              >
                <Icon size={12} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

export function App(): JSX.Element {
  useSessionLifecycle()
  useLayoutPersistence()
  useLayoutRestore()
  useAutoUpdater()

  const tabOrder = useStore((s) => s.tabOrder)
  const sessions = useStore((s) => s.sessions)
  const appTheme = useStore((s) => s.settings.theme)

  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sidePanel, setSidePanel] = useState<'notes' | 'settings' | 'git' | null>(null)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [openNoteIds, setOpenNoteIds] = useState<Set<string>>(new Set())
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string | null>(null)
  const [workspaceProject, setWorkspaceProject] = useState<string | null>(
    () => localStorage.getItem('orbit:workspaceProject') ?? null
  )
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const selectedSession = useStore((s) => workspaceSessionId ? s.sessions[workspaceSessionId] : null)
  const gitRoot = selectedSession?.worktreePath ?? workspaceProject
  const gitReview = useGitReview(gitRoot, selectedSession?.worktreeBaseBranch)
  const totalChanges =
    (gitReview.data?.staged.length ?? 0) +
    (gitReview.data?.unstaged.length ?? 0) +
    (gitReview.data?.untracked.length ?? 0)

  useEffect(() => {
    const handler = (): void => { if (gitRoot) setSidePanel(p => p === 'git' ? null : 'git') }
    document.addEventListener('acc:toggle-git-review', handler)
    return () => document.removeEventListener('acc:toggle-git-review', handler)
  }, [gitRoot])

  useEffect(() => { setSidePanel(null) }, [workspaceProject])

  const handleWorkspaceProjectChange = useCallback((path: string | null) => {
    setWorkspaceProject(path)
    setWorkspaceSessionId(null)
    if (path) localStorage.setItem('orbit:workspaceProject', path)
    else localStorage.removeItem('orbit:workspaceProject')
  }, [])

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

  useEffect(() => {
    const html = document.documentElement
    const applyTheme = (): void => {
      const isDark = appTheme === 'dark' || appTheme === 'space' || (appTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      html.classList.toggle('dark', isDark)
      html.classList.toggle('space', appTheme === 'space')
    }
    applyTheme()
    if (appTheme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', applyTheme)
      return () => mq.removeEventListener('change', applyTheme)
    }
    return undefined
  }, [appTheme])

  const addNote = useStore((s) => s.addNote)
  const storeSaveNote = useStore((s) => s.saveNote)
  const notes = useStore((s) => s.notes)

  const notesInitRef = useRef(false)
  useEffect(() => {
    if (!notesInitRef.current && notes.length > 0) {
      notesInitRef.current = true
      const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)
      setOpenNoteIds(new Set([sorted[0].id]))
      setActiveNoteId(sorted[0].id)
    }
  }, [notes])

  useEffect(() => {
    const existingIds = new Set(notes.map(n => n.id))
    setOpenNoteIds(prev => {
      const cleaned = [...prev].filter(id => existingIds.has(id))
      if (cleaned.length === prev.size) return prev
      return new Set(cleaned)
    })
  }, [notes])

  const createNote = useCallback((): string => {
    const { notes: current } = useStore.getState()
    const sorted = current.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    if (sorted.length > 0 && sorted[0].content.trim() === '') {
      const existing = sorted[0].id
      setOpenNoteIds((prev) => { const next = new Set(prev); next.add(existing); return next })
      return existing
    }
    const id = crypto.randomUUID()
    addNote(id)
    storeSaveNote(id, '')
    setOpenNoteIds((prev) => { const next = new Set(prev); next.add(id); return next })
    return id
  }, [addNote, storeSaveNote])

  const handleNoteActivate = useCallback((id: string): void => {
    setActiveNoteId(id)
    setOpenNoteIds((prev) => { const next = new Set(prev); next.add(id); return next })
  }, [])

  const handleNoteClose = useCallback((id: string): void => {
    setOpenNoteIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setActiveNoteId((prev) => {
      if (prev !== id) return prev
      const remaining = [...openNoteIds].filter((nid) => nid !== id)
      return remaining.length > 0 ? remaining[remaining.length - 1] : null
    })
  }, [openNoteIds])

  useKeyboardShortcuts({
    onTogglePalette: () => setPaletteOpen((v) => !v),
    onShowShortcuts: () => setShortcutsOpen((v) => !v),
    onNewNoteDrawer: useCallback(() => {
      setSidePanel(p => {
        if (p === 'notes') return null
        const { notes: n } = useStore.getState()
        const sorted = n.slice().sort((a, b) => b.updatedAt - a.updatedAt)
        if (sorted.length > 0) setActiveNoteId(sorted[0].id)
        else createNote()
        return 'notes'
      })
    }, [createNote]),
  })

  const { handleSplitH, handleSplitV, handleDetach, handleReattach, handleClose } = usePaneActions(contextMenu)

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string, tabId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId, tabId })
  }, [])

  const activeMeta = workspaceSessionId ? sessions[workspaceSessionId] : null
  const titleBarTitle = sidePanel === 'settings' ? 'Settings' : (activeMeta?.name ?? 'Orbit')
  const titleBarSubtitle = sidePanel === 'settings' ? '' : (activeMeta?.cwd ?? '')

  const handleNotesToggle = useCallback((): void => {
    setSidePanel(p => {
      if (p === 'notes') return null
      const { notes: n } = useStore.getState()
      const sorted = n.slice().sort((a, b) => b.updatedAt - a.updatedAt)
      if (sorted.length > 0) setActiveNoteId(sorted[0].id)
      else createNote()
      return 'notes'
    })
  }, [createNote])

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-zinc-100 overflow-hidden">
      <TitleBar title={titleBarTitle} subtitle={titleBarSubtitle} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — always visible */}
        <div style={{ width: sidebarWidth, flexShrink: 0 }} className="flex flex-col h-full border-r border-brand-panel">
          <AgentMonitorSidebar
            activeProject={workspaceProject}
            onProjectChange={handleWorkspaceProjectChange}
            activeSessionId={workspaceSessionId}
            onSelectSession={setWorkspaceSessionId}
          />
        </div>
        <div
          className="w-1 flex-shrink-0 bg-brand-panel hover:bg-brand-accent transition-colors cursor-col-resize"
          onMouseDown={handleSidebarDragStart}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 min-h-0 relative">
          {workspaceSessionId === null ? (
            <div className="absolute inset-0">
              <EmptyState />
            </div>
          ) : (
            <AgentMonitorLayout
              sessionId={workspaceSessionId}
              onSessionClose={() => setWorkspaceSessionId(null)}
            />
          )}

          {sidePanel !== null && (
            <>
              <div className="absolute inset-0 z-10" onClick={() => setSidePanel(null)} />
              <div
                className={cn(
                  'absolute right-0 top-0 h-full z-20 border-l border-brand-panel bg-brand-surface flex flex-col shadow-2xl',
                  sidePanel === 'notes' ? 'w-[640px]' : sidePanel === 'settings' ? 'w-[520px]' : 'w-[420px]'
                )}
              >
                {sidePanel === 'notes' && (
                  <NoteDrawer
                    open={false}
                    onClose={() => {}}
                    activeNoteId={activeNoteId}
                    onActivate={handleNoteActivate}
                    onCreate={() => { const id = createNote(); setActiveNoteId(id) }}
                    expanded={true}
                    onToggleExpand={() => setSidePanel(null)}
                  />
                )}
                {sidePanel === 'settings' && <SettingsForm onClose={() => setSidePanel(null)} />}
                {sidePanel === 'git' && <GitReviewPanel projectRoot={gitRoot} gitReview={gitReview} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between h-10 px-3 bg-brand-surface border-t border-brand-panel flex-shrink-0">
        <span className="text-xs text-zinc-500">
          {tabOrder.length === 0 ? 'No sessions' : `${tabOrder.length} session${tabOrder.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-0.5">
          {workspaceProject !== null && (
            <button
              onClick={() => { if (gitRoot) setSidePanel(p => p === 'git' ? null : 'git') }}
              title="Review Changes (Ctrl+Shift+G)"
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 h-7 rounded transition-colors',
                sidePanel === 'git'
                  ? 'text-brand-muted bg-brand-panel'
                  : totalChanges > 0
                    ? 'text-zinc-300 hover:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <GitBranch size={15} />
              <span className="text-[11px] font-medium">Git</span>
              {totalChanges > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-brand-accent text-[9px] font-bold text-brand-bg leading-none border-2 border-brand-surface">
                  {totalChanges > 99 ? '99+' : totalChanges}
                </span>
              )}
            </button>
          )}
          <button
            onClick={handleNotesToggle}
            title="Notes"
            className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded transition-colors', sidePanel === 'notes' ? 'text-brand-muted bg-brand-panel' : 'text-zinc-500 hover:text-zinc-300')}
          >
            <NotebookPen size={15} />
            <span className="text-[11px] font-medium">Notes</span>
          </button>
          <StatusThemeToggle />
          <button
            onClick={() => setSidePanel(p => p === 'settings' ? null : 'settings')}
            title="Settings"
            className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded transition-colors', sidePanel === 'settings' ? 'text-brand-muted bg-brand-panel' : 'text-zinc-500 hover:text-zinc-300')}
          >
            <Settings size={15} />
            <span className="text-[11px] font-medium">Settings</span>
          </button>
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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onShowShortcuts={() => { setPaletteOpen(false); setShortcutsOpen(true) }}
      />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  )
}
