import { useState, useEffect, useRef, useCallback } from 'react'
import { X, FolderOpen, FolderClosed, Plus, Terminal, Loader2, ExternalLink, Copy, ChevronDown, ChevronRight, Pencil, Check, Layers } from 'lucide-react'
import { createPortal } from 'react-dom'
import { NewSessionForm } from './NewSessionForm'
import { useStore } from '../../../store/root.store'
import { findTabForSession } from '../../terminal/pane-tree'
import { FileTree } from '../../fs/components/FileTree'
import { useProjects } from '../hooks/useProjects'
import { useInstalledEditors } from '../../fs/hooks/useInstalledEditors'
import { showInFolder, openInEditor, openPath } from '../../fs/fs.service'
import { createSession, patchSession } from '../session.service'
import { cn } from '../../../lib/utils'
import type { SessionMeta } from '@shared/ipc-types'

interface ProjectCtxMenu { x: number; y: number; path: string }

function ProjectContextMenu({ x, y, path, onDismiss }: ProjectCtxMenu & { onDismiss: () => void }): JSX.Element {
  const editors = useInstalledEditors()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      onDismiss()
    }
    document.addEventListener('mousedown', handler, { capture: true })
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handler, { capture: true })
      document.removeEventListener('contextmenu', handler, { capture: true })
    }
  }, [onDismiss])

  const ax = Math.min(x, window.innerWidth - 220)
  const ay = Math.min(y, window.innerHeight - 200)
  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: ay, left: ax, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-52"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button onClick={dismiss(() => openPath(path))}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left">
        <ExternalLink size={12} className="flex-shrink-0" />
        Open
      </button>
      {editors.map((ed) => (
        <button key={ed.command} onClick={dismiss(() => openInEditor(ed.command, path))}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left">
          <ExternalLink size={12} className="flex-shrink-0" />
          Open in {ed.name}
        </button>
      ))}
      <div className="h-px bg-brand-panel my-1" />
      <button onClick={dismiss(() => navigator.clipboard.writeText(path))}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left">
        <Copy size={12} className="flex-shrink-0" />
        Copy Path
      </button>
      <div className="h-px bg-brand-panel my-1" />
      <button onClick={dismiss(() => showInFolder(path))}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left">
        <FolderOpen size={12} className="flex-shrink-0" />
        Reveal in Explorer
      </button>
    </div>,
    document.body
  )
}

// ─── Session group context menu ───────────────────────────────────────────────

interface SessionCtxMenuProps {
  x: number
  y: number
  meta: SessionMeta
  groups: { id: string; name: string }[]
  onAssign: (groupId: string | null) => void
  onNewGroup: () => void
  onDismiss: () => void
}

function SessionGroupMenu({ x, y, meta, groups, onAssign, onNewGroup, onDismiss }: SessionCtxMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      onDismiss()
    }
    document.addEventListener('mousedown', handler, { capture: true })
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handler, { capture: true })
      document.removeEventListener('contextmenu', handler, { capture: true })
    }
  }, [onDismiss])

  const ax = Math.min(x, window.innerWidth - 200)
  const ay = Math.min(y, window.innerHeight - 220)

  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: ay, left: ax, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-48"
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wider">Move to group</p>
      {meta.groupId && (
        <button
          onClick={dismiss(() => onAssign(null))}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
        >
          <X size={11} className="flex-shrink-0" />
          No group
        </button>
      )}
      {groups.map((g) => (
        <button
          key={g.id}
          onClick={dismiss(() => onAssign(g.id))}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
        >
          <Check size={11} className={cn('flex-shrink-0', meta.groupId === g.id ? 'text-brand-green' : 'opacity-0')} />
          {g.name}
        </button>
      ))}
      <div className="h-px bg-brand-panel my-1" />
      <button
        onClick={dismiss(onNewGroup)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
      >
        <Plus size={11} className="flex-shrink-0" />
        New group…
      </button>
    </div>,
    document.body
  )
}

// ─── Project section (projects tab) ──────────────────────────────────────────

interface ProjectSectionProps {
  path: string
  name: string
  refreshTick: number
  activeFilePath: string | null
  onFileClick: (path: string, xy: string | undefined) => void
  onNewSession: () => void
  onRemove: () => void
}

function ProjectSection({ path, name, refreshTick, activeFilePath, onFileClick, onNewSession, onRemove }: ProjectSectionProps): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  return (
    <div className="flex flex-col flex-shrink-0">
      {ctxMenu && <ProjectContextMenu x={ctxMenu.x} y={ctxMenu.y} path={path} onDismiss={() => setCtxMenu(null)} />}
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 border-b border-brand-panel/60 cursor-pointer hover:bg-brand-panel/20 transition-colors"
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      >
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 flex-1 min-w-0">
          {expanded ? <FolderOpen size={13} className="text-brand-light flex-shrink-0" /> : <FolderClosed size={13} className="text-zinc-500 flex-shrink-0" />}
          <span className="text-xs font-semibold text-zinc-200 truncate">{name}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onNewSession() }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-brand-light transition-colors" title="New session in this project"><Terminal size={11} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-colors" title="Remove"><X size={11} /></button>
      </div>
      {expanded && <FileTree projectRoot={path} activeFilePath={activeFilePath} onFileClick={onFileClick} refreshTick={refreshTick} />}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 2) return p.replace(/\\/g, '/')
  return `…/${parts.slice(-2).join('/')}`
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

// ─── Session row ─────────────────────────────────────────────────────────────

interface SessionRowProps {
  meta: SessionMeta
  isFocused: boolean
  tabId: string | undefined
  groups: { id: string; name: string }[]
  onActivate: () => void
  onClose: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function SessionRow({ meta, isFocused, tabId, groups, onActivate, onClose, onContextMenu }: SessionRowProps): JSX.Element {
  const isRunning = meta.status === 'running'
  const agentStatus = meta.agentStatus ?? 'idle'
  const sessionColor = meta.color ?? '#22c55e'

  return (
    <div
      className={cn(
        'group w-full flex flex-col gap-0.5 px-3 py-2 transition-colors border-l-2',
        tabId ? 'cursor-pointer' : 'opacity-30 cursor-default',
        isFocused ? 'bg-brand-panel border-l-brand-green' : 'border-l-transparent hover:bg-brand-surface'
      )}
      onClick={onActivate}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e) }}
    >
      <div className="flex items-center gap-2">
        {isRunning && agentStatus === 'running' ? (
          <Loader2 size={11} className="flex-shrink-0 animate-spin" style={{ color: sessionColor }} />
        ) : isRunning && agentStatus === 'waiting-input' ? (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400 animate-pulse" />
        ) : (
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isRunning ? 'bg-green-400' : 'bg-zinc-600')} />
        )}
        <span className={cn('text-xs font-medium truncate flex-1', isFocused ? 'text-zinc-100' : 'text-zinc-500')}>
          {meta.name}
        </span>
        <span className={cn('text-[10px] flex-shrink-0', isFocused ? 'text-zinc-400' : 'text-zinc-700')}>
          {timeAgo(meta.createdAt)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="flex-shrink-0 text-zinc-700 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100 ml-0.5"
          title="Close session"
        >
          <X size={13} />
        </button>
      </div>
      <div className={cn('pl-3.5 text-[10px] truncate', isFocused ? 'text-zinc-400' : 'text-zinc-600')}>
        {shortPath(meta.cwd)}
      </div>
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: { id: string; name: string }
  sessions: SessionMeta[]
  collapsed: boolean
  onToggle: () => void
  onRename: (name: string) => void
  onDelete: () => void
  sessionProps: Omit<SessionRowProps, 'meta' | 'isFocused' | 'tabId' | 'onActivate' | 'onClose' | 'onContextMenu'>
  focusedSessionId: string | null
  paneTree: Record<string, unknown>
  onActivate: (tabId: string, sessionId: string) => void
  onClose: (sessionId: string) => void
  onSessionCtxMenu: (e: React.MouseEvent, meta: SessionMeta) => void
}

function GroupSection({ group, sessions, collapsed, onToggle, onRename, onDelete, focusedSessionId, paneTree, onActivate, onClose, onSessionCtxMenu }: GroupSectionProps): JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const [nameVal, setNameVal] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = (): void => {
    setNameVal(group.name)
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = (): void => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== group.name) onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-1.5 px-2 py-1.5 border-b border-brand-panel/40 hover:bg-brand-panel/10 transition-colors">
        <button onClick={onToggle} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <Layers size={11} className="text-zinc-600 flex-shrink-0" />
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
            className="flex-1 bg-brand-panel border border-brand-green/50 rounded px-1 text-xs text-zinc-100 outline-none min-w-0"
          />
        ) : (
          <span
            className="text-xs font-semibold text-zinc-400 flex-1 truncate"
            onDoubleClick={startRename}
          >
            {group.name}
          </span>
        )}
        <span className="text-[10px] text-zinc-700 flex-shrink-0">{sessions.length}</span>
        <button
          onClick={startRename}
          className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0"
          title="Rename group"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-400 transition-colors flex-shrink-0"
          title="Delete group"
        >
          <X size={11} />
        </button>
      </div>

      {!collapsed && sessions.map((meta) => {
        const tabId = findTabForSession(paneTree as any, meta.sessionId)
        return (
          <div key={meta.sessionId} className="pl-3 border-l border-brand-panel/30 ml-3">
            <SessionRow
              meta={meta}
              isFocused={focusedSessionId === meta.sessionId}
              tabId={tabId}
              groups={[]}
              onActivate={() => { if (tabId) onActivate(tabId, meta.sessionId) }}
              onClose={() => onClose(meta.sessionId)}
              onContextMenu={(e) => onSessionCtxMenu(e, meta)}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  onFileClick: (path: string, xy: string | undefined) => void
  activeTab: 'sessions' | 'projects'
  activeFilePath: string | null
  externalRefreshTick?: number
  onSwitchToSessions: () => void
}

export function SessionDashboard({ onFileClick, activeTab, activeFilePath, externalRefreshTick, onSwitchToSessions }: Props): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const paneTree = useStore((s) => s.paneTree)
  const focusedSessionId = useStore((s) => s.focusedSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const setFocusedSession = useStore((s) => s.setFocusedSession)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const settings = useStore((s) => s.settings)

  const { openProjects, refreshTicks, bumpRefresh, addProject, removeProject, closeSession } = useProjects()

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sessionCtxMenu, setSessionCtxMenu] = useState<{ x: number; y: number; meta: SessionMeta } | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!externalRefreshTick) return
    openProjects.forEach((path) => bumpRefresh(path))
  }, [externalRefreshTick])

  useEffect(() => {
    if (creatingGroup) setTimeout(() => newGroupInputRef.current?.focus(), 0)
  }, [creatingGroup])

  const allSessions = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt)
  const groups = settings.sessionGroups ?? []

  const handleAssignGroup = useCallback(async (sessionId: string, groupId: string | null) => {
    const updated = await patchSession({ sessionId, groupId })
    upsertSession(updated)
  }, [upsertSession])

  const handleCreateGroup = useCallback(async (name: string, assignSessionId?: string) => {
    const id = crypto.randomUUID()
    const newGroups = [...groups, { id, name }]
    await updateSettings({ sessionGroups: newGroups })
    if (assignSessionId) {
      const updated = await patchSession({ sessionId: assignSessionId, groupId: id })
      upsertSession(updated)
    }
  }, [groups, updateSettings, upsertSession])

  const handleRenameGroup = useCallback(async (groupId: string, name: string) => {
    await updateSettings({ sessionGroups: groups.map((g) => g.id === groupId ? { ...g, name } : g) })
  }, [groups, updateSettings])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    // Ungroup all sessions in this group
    const inGroup = allSessions.filter((m) => m.groupId === groupId)
    await Promise.all(inGroup.map((m) => patchSession({ sessionId: m.sessionId, groupId: null }).then(upsertSession)))
    await updateSettings({ sessionGroups: groups.filter((g) => g.id !== groupId) })
  }, [groups, allSessions, updateSettings, upsertSession])

  const handleCommitNewGroup = useCallback(async () => {
    const name = newGroupName.trim()
    setCreatingGroup(false)
    setNewGroupName('')
    if (!name) return
    await handleCreateGroup(name)
  }, [newGroupName, handleCreateGroup])

  const handleNewGroupForSession = useCallback(async (meta: SessionMeta) => {
    const id = crypto.randomUUID()
    const newGroups = [...groups, { id, name: 'New Group' }]
    await updateSettings({ sessionGroups: newGroups })
    const updated = await patchSession({ sessionId: meta.sessionId, groupId: id })
    upsertSession(updated)
  }, [groups, updateSettings, upsertSession])

  const ungroupedSessions = allSessions.filter((m) => !m.groupId || !groups.find((g) => g.id === m.groupId))

  return (
    <div className="flex flex-col w-full h-full bg-brand-bg">
      {/* Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto py-1">
            {/* Group sections */}
            {groups.map((group) => {
              const groupSessions = allSessions.filter((m) => m.groupId === group.id)
              const collapsed = collapsedGroups.has(group.id)
              return (
                <GroupSection
                  key={group.id}
                  group={group}
                  sessions={groupSessions}
                  collapsed={collapsed}
                  onToggle={() => setCollapsedGroups((prev) => {
                    const next = new Set(prev)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)
                    return next
                  })}
                  onRename={(name) => handleRenameGroup(group.id, name)}
                  onDelete={() => handleDeleteGroup(group.id)}
                  sessionProps={{} as any}
                  focusedSessionId={focusedSessionId}
                  paneTree={paneTree}
                  onActivate={(tabId, sessionId) => { setActiveSession(tabId); setFocusedSession(sessionId) }}
                  onClose={(sessionId) => closeSession(sessionId)}
                  onSessionCtxMenu={(e, meta) => setSessionCtxMenu({ x: e.clientX, y: e.clientY, meta })}
                />
              )
            })}

            {/* Ungrouped sessions */}
            {ungroupedSessions.length > 0 && (
              <>
                {groups.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] text-zinc-700 uppercase tracking-wider">Ungrouped</span>
                  </div>
                )}
                {ungroupedSessions.length === 0 && allSessions.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center mt-6">No sessions</p>
                )}
                {ungroupedSessions.map((meta) => {
                  const tabId = findTabForSession(paneTree, meta.sessionId)
                  return (
                    <SessionRow
                      key={meta.sessionId}
                      meta={meta}
                      isFocused={focusedSessionId === meta.sessionId}
                      tabId={tabId}
                      groups={groups}
                      onActivate={() => { if (tabId) { setActiveSession(tabId); setFocusedSession(meta.sessionId) } }}
                      onClose={() => closeSession(meta.sessionId)}
                      onContextMenu={(e) => setSessionCtxMenu({ x: e.clientX, y: e.clientY, meta })}
                    />
                  )
                })}
              </>
            )}

            {allSessions.length === 0 && (
              <p className="text-xs text-zinc-600 text-center mt-6">No sessions</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-brand-panel/60 p-2 flex flex-col gap-1">
            {creatingGroup && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-panel/40 rounded">
                <Layers size={11} className="text-zinc-500 flex-shrink-0" />
                <input
                  ref={newGroupInputRef}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitNewGroup()
                    if (e.key === 'Escape') { setCreatingGroup(false); setNewGroupName('') }
                  }}
                  onBlur={handleCommitNewGroup}
                  placeholder="Group name…"
                  className="flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
            )}
            <div className="flex gap-1">
              <NewSessionForm variant="sidebar" />
              <button
                onClick={() => setCreatingGroup(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs text-zinc-600 hover:bg-brand-panel hover:text-zinc-400 transition-colors rounded"
                title="New group"
              >
                <Layers size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            {openProjects.length === 0 && (
              <p className="text-xs text-zinc-600 text-center mt-6">No projects open</p>
            )}
            {openProjects.map((p) => {
              const name = p.split('/').filter(Boolean).pop() ?? p
              return (
                <ProjectSection
                  key={p}
                  path={p}
                  name={name}
                  refreshTick={refreshTicks[p] ?? 0}
                  activeFilePath={activeFilePath}
                  onFileClick={onFileClick}
                  onNewSession={async () => {
                    try {
                      const meta = await createSession({ name, agentCommand: 'claude', cwd: p, cols: 80, rows: 24 })
                      upsertSession(meta)
                      addTab(meta.sessionId)
                      updateSettings({ projectRoot: p })
                      onSwitchToSessions()
                    } catch {}
                  }}
                  onRemove={() => removeProject(p)}
                />
              )
            })}
          </div>
          <div className="flex-shrink-0 border-t border-brand-panel/60 p-2">
            <button
              onClick={addProject}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-light transition-colors rounded"
            >
              <FolderOpen size={13} /> Open Project
            </button>
          </div>
        </div>
      )}

      {/* Session group assignment context menu */}
      {sessionCtxMenu && (
        <SessionGroupMenu
          x={sessionCtxMenu.x}
          y={sessionCtxMenu.y}
          meta={sessionCtxMenu.meta}
          groups={groups}
          onAssign={(groupId) => handleAssignGroup(sessionCtxMenu.meta.sessionId, groupId)}
          onNewGroup={() => handleNewGroupForSession(sessionCtxMenu.meta)}
          onDismiss={() => setSessionCtxMenu(null)}
        />
      )}
    </div>
  )
}
