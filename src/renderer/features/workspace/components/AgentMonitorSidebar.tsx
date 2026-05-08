import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, Loader2, FolderOpen, Pencil, X, Users } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useStore } from '../../../store/root.store'
import { useProjects } from '../../session/hooks/useProjects'
import { createSession, patchSession, killSession, SESSION_COLORS } from '../../session/session.service'
import { createWorktree, removeWorktree } from '../../fs/fs.service'
import { useWorktreeStats } from '../hooks/useWorktreeStats'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import { toast } from 'sonner'
import { cn } from '../../../lib/utils'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Skeleton } from '../../../components/ui/skeleton'
import type { SessionMeta } from '@shared/ipc-types'

interface Props {
  activeProject: string | null
  onProjectChange: (path: string | null) => void
  activeSessionId: string | null
  onSelectSession: (id: string | null) => void
}

const MAX_NAME_LENGTH = 32
const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6']

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 2) return p.replace(/\\/g, '/')
  return `…/${parts.slice(-2).join('/')}`
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface EditModalProps {
  meta: SessionMeta
  onSave: (name: string, color: string) => void
  onDismiss: () => void
}

function EditModal({ meta, onSave, onDismiss }: EditModalProps): JSX.Element {
  const [name, setName] = useState(meta.name)
  const [color, setColor] = useState(meta.color ?? SESSION_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  const validate = (v: string): string | null => {
    if (!v.trim()) return 'Name cannot be blank'
    if (v.trim().length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`
    return null
  }

  const handleSave = (): void => {
    const trimmed = name.trim()
    const err = validate(trimmed)
    if (err) { setError(err); return }
    onSave(trimmed, color)
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onDismiss() }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">Edit Session</span>
          <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={14} /></button>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Name</Label>
            <span className={cn('text-xs', name.trim().length > MAX_NAME_LENGTH ? 'text-red-400' : 'text-zinc-600')}>{name.trim().length}/{MAX_NAME_LENGTH}</span>
          </div>
          <Input ref={inputRef} value={name} onChange={(e) => { setName(e.target.value); setError(validate(e.target.value)) }} onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }} className={cn(error ? 'border-red-500/70 focus-visible:ring-0 focus:border-red-400' : '')} />
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-zinc-500">Color</Label>
          <div className="flex gap-2 flex-wrap">
            {SESSION_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }} className={cn('w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0', color === c && 'ring-2 ring-white ring-offset-2 ring-offset-brand-surface scale-110')} />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onDismiss} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded">Cancel</button>
          <button onClick={handleSave} disabled={!!error || !name.trim()} className="px-4 py-1.5 text-xs font-medium rounded bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface SessionRowProps {
  meta: SessionMeta
  activeSessionId: string | null
  worktreeStats: Record<string, { added: number; deleted: number; commits: number }>
  isNoWorkspace: boolean
  dragging: boolean
  onSelectSession: (id: string) => void
  onEditMeta: (meta: SessionMeta) => void
  onCtxMenu: (v: { x: number; y: number; meta: SessionMeta }) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

function SessionRow({ meta, activeSessionId, worktreeStats, isNoWorkspace, dragging, onSelectSession, onEditMeta, onCtxMenu, onDragStart, onDragEnd }: SessionRowProps): JSX.Element {
  const isSelected = activeSessionId === meta.sessionId
  const isRunning = meta.status === 'running'
  const agentStatus = meta.agentStatus ?? 'idle'
  const sessionColor = meta.color ?? '#22c55e'
  const stats = isNoWorkspace ? undefined : worktreeStats[meta.sessionId]
  const hasStats = stats && (stats.added > 0 || stats.deleted > 0)
  const subtext = isNoWorkspace ? shortPath(meta.cwd) : (meta.worktreeBranch ?? shortPath(meta.cwd))

  return (
    <button
      draggable={isNoWorkspace}
      onDragStart={isNoWorkspace ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(meta.sessionId) } : undefined}
      onDragEnd={isNoWorkspace ? onDragEnd : undefined}
      onClick={() => onSelectSession(meta.sessionId)}
      onDoubleClick={(e) => { e.stopPropagation(); onEditMeta(meta) }}
      onContextMenu={(e) => { e.preventDefault(); onCtxMenu({ x: e.clientX, y: e.clientY, meta }) }}
      className={cn('w-full flex flex-col gap-0.5 px-3 py-2 transition-all border-l-2 text-left', dragging && 'opacity-40')}
      style={{ borderLeftColor: isSelected ? sessionColor : 'transparent', background: `linear-gradient(to right, ${sessionColor}${isSelected ? '2e' : '12'}, transparent)` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isRunning && agentStatus === 'running' ? (
          <Loader2 size={11} className="flex-shrink-0 animate-spin" style={{ color: sessionColor }} />
        ) : isRunning && agentStatus === 'waiting-input' ? (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: sessionColor }} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isRunning ? sessionColor : '#52525b' }} />
        )}
        <span className={cn('text-xs font-medium truncate flex-1 min-w-0', isSelected ? 'text-zinc-100' : 'text-zinc-500')}>{meta.name}</span>
        {!isNoWorkspace && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasStats && (
              <span className="text-[10px] font-mono leading-none">
                <span className="text-green-500">+{stats.added}</span>
                <span className="text-zinc-600 mx-0.5">·</span>
                <span className="text-red-500">-{stats.deleted}</span>
              </span>
            )}
            {stats && stats.commits > 0 && <span className="text-[10px] text-zinc-500 leading-none">⑂{stats.commits}</span>}
          </div>
        )}
      </div>
      <div className={cn('pl-3.5 text-[10px] truncate font-mono', isSelected ? 'text-zinc-400' : 'text-zinc-600')}>{subtext}</div>
    </button>
  )
}

export function AgentMonitorSidebar({ activeProject, onProjectChange, activeSessionId, onSelectSession }: Props): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const isRestoringLayout = useStore((s) => s.isRestoringLayout)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const removeTab = useStore((s) => s.removeTab)
  const defaultSessionDir = useStore((s) => s.settings.defaultSessionDir)
  const sessionGroups = useStore((s) => s.settings.sessionGroups)
  const updateSettings = useStore((s) => s.updateSettings)

  const { openProjects, addProject } = useProjects()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  // footerMode: 'idle' | 'newSession' | 'newGroup'
  const [footerMode, setFooterMode] = useState<'idle' | 'newSession' | 'newGroup'>('idle')
  const [sessionName, setSessionName] = useState('')
  const [sessionDir, setSessionDir] = useState('')
  const [sessionGroupId, setSessionGroupId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; meta: SessionMeta } | null>(null)
  const [editMeta, setEditMeta] = useState<SessionMeta | null>(null)
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null | 'ungrouped'>('ungrouped')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const groupInputRef = useRef<HTMLInputElement>(null)

  const isNoWorkspace = activeProject === null
  const normalizedActive = activeProject?.replace(/\\/g, '/')

  const projectSessions: SessionMeta[] = useMemo(() =>
    Object.values(sessions)
      .filter((m) => {
        if (isNoWorkspace) return !m.worktreePath
        if (!normalizedActive) return false
        const root = (m.projectRoot ?? m.cwd).replace(/\\/g, '/')
        return (root === normalizedActive || root.startsWith(normalizedActive + '/')) && !!m.worktreePath
      })
      .sort((a, b) => b.createdAt - a.createdAt),
    [sessions, isNoWorkspace, normalizedActive]
  )

  const worktreeStats = useWorktreeStats(isNoWorkspace ? [] : projectSessions)

  const grouped = useMemo(() => {
    if (!isNoWorkspace) return null
    const byGroup: Record<string, SessionMeta[]> = {}
    const ungrouped: SessionMeta[] = []
    for (const s of projectSessions) {
      if (s.groupId) (byGroup[s.groupId] ??= []).push(s)
      else ungrouped.push(s)
    }
    return { byGroup, ungrouped }
  }, [isNoWorkspace, projectSessions])

  useEffect(() => {
    const handler = (): void => setFooterMode('newSession')
    document.addEventListener('acc:new-session', handler)
    return () => document.removeEventListener('acc:new-session', handler)
  }, [])

  useEffect(() => { if (footerMode !== 'idle') nameInputRef.current?.focus() }, [footerMode])

  useEffect(() => {
    setFooterMode('idle')
    setSessionName(''); setSessionDir(''); setSessionGroupId(''); setTaskName('')
    setNewGroupName(''); setNewGroupColor(GROUP_COLORS[0])
  }, [normalizedActive, isNoWorkspace])

  useEffect(() => {
    if (!activeSessionId && projectSessions.length > 0) onSelectSession(projectSessions[0].sessionId)
  }, [projectSessions.length, activeSessionId, onSelectSession])

  const resetFooter = (): void => {
    setFooterMode('idle')
    setSessionName(''); setSessionDir(''); setSessionGroupId(''); setTaskName('')
    setNewGroupName(''); setNewGroupColor(GROUP_COLORS[0])
  }

  const handleDrop = useCallback(async (targetGroupId: string | null) => {
    if (!draggedSessionId) return
    setDragOverGroupId(null)
    const session = useStore.getState().sessions[draggedSessionId]
    if (!session || session.groupId === (targetGroupId ?? undefined)) return
    try {
      const patched = await patchSession({ sessionId: draggedSessionId, groupId: targetGroupId })
      upsertSession(patched)
    } catch {}
  }, [draggedSessionId, upsertSession])

  const handleCloseSession = useCallback(async (meta: SessionMeta) => {
    try { await killSession(meta.sessionId) } catch {}
    removeTab(meta.sessionId)
    if (meta.worktreePath && meta.projectRoot) removeWorktree(meta.projectRoot, meta.worktreePath).catch(() => {})
    if (activeSessionId === meta.sessionId) {
      const remaining = Object.values(useStore.getState().sessions)
        .filter((s) => {
          if (s.sessionId === meta.sessionId) return false
          if (isNoWorkspace) return !s.worktreePath
          const na = normalizedActive ?? ''
          const root = (s.projectRoot ?? s.cwd).replace(/\\/g, '/')
          return na && (root === na || root.startsWith(na + '/')) && !!s.worktreePath
        })
        .sort((a, b) => b.createdAt - a.createdAt)
      onSelectSession(remaining[0]?.sessionId ?? null)
    }
  }, [activeSessionId, isNoWorkspace, normalizedActive, removeTab, onSelectSession])

  const handleEditSave = useCallback(async (meta: SessionMeta, name: string, color: string) => {
    try { const patched = await patchSession({ sessionId: meta.sessionId, name, color }); upsertSession(patched) } catch {}
    setEditMeta(null)
  }, [upsertSession])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    const sessionsInGroup = projectSessions.filter((s) => s.groupId === groupId)
    await Promise.all(sessionsInGroup.map((s) =>
      patchSession({ sessionId: s.sessionId, groupId: null }).then((p) => upsertSession(p)).catch(() => {})
    ))
    await updateSettings({ sessionGroups: sessionGroups.filter((g) => g.id !== groupId) })
  }, [projectSessions, sessionGroups, updateSettings, upsertSession])

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const id = crypto.randomUUID()
      await updateSettings({ sessionGroups: [...sessionGroups, { id, name, color: newGroupColor }] })
      toast.success(`Group "${name}" created`)
      resetFooter()
    } catch (err) {
      toast.error(`Group failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreating(false)
    }
  }, [newGroupName, newGroupColor, creating, sessionGroups, updateSettings])

  const handleCreateWorkspaceSession = useCallback(async () => {
    if (!activeProject || creating) return
    setCreating(true)
    try {
      const projectName = activeProject.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'session'
      const task = taskName.trim()
      const branchName = `orbit/${slugify(projectName)}-${task ? slugify(task) : Date.now().toString(36).slice(-4)}`
      const name = task || projectName
      let worktreeResult: { worktreePath: string; branchName: string; baseBranch: string }
      try { worktreeResult = await createWorktree(activeProject, branchName) }
      catch (err) { toast.error(`Worktree failed: ${err instanceof Error ? err.message : String(err)}`); return }
      const meta = await createSession({ name, agentCommand: 'claude', cwd: worktreeResult.worktreePath, cols: 80, rows: 24 })
      const patched = await patchSession({ sessionId: meta.sessionId, worktreePath: worktreeResult.worktreePath, worktreeBranch: worktreeResult.branchName, worktreeBaseBranch: worktreeResult.baseBranch, projectRoot: activeProject })
      upsertSession(patched)
      addTab(meta.sessionId)
      onSelectSession(meta.sessionId)
      resetFooter()
    } catch (err) { toast.error(`Session failed: ${err instanceof Error ? err.message : String(err)}`) }
    finally { setCreating(false) }
  }, [activeProject, creating, taskName, upsertSession, addTab, onSelectSession])

  const handleCreateNoWorkspaceSession = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const name = sessionName.trim() || 'Session'
      const cwd = sessionDir.trim() || defaultSessionDir || undefined
      const groupId = sessionGroupId || undefined
      const meta = await createSession({ name, cwd, cols: 80, rows: 24, groupId })
      upsertSession(meta)
      addTab(meta.sessionId)
      onSelectSession(meta.sessionId)
      resetFooter()
    } catch (err) { toast.error(`Session failed: ${err instanceof Error ? err.message : String(err)}`) }
    finally { setCreating(false) }
  }, [creating, sessionName, sessionDir, sessionGroupId, defaultSessionDir, upsertSession, addTab, onSelectSession])

  const workspaceLabel = isNoWorkspace ? 'No Workspace'
    : normalizedActive ? normalizedActive.split('/').filter(Boolean).pop() ?? normalizedActive
    : 'No Workspace'

  const renderSessionRow = (meta: SessionMeta): JSX.Element => (
    <SessionRow
      key={meta.sessionId}
      meta={meta}
      activeSessionId={activeSessionId}
      worktreeStats={worktreeStats}
      isNoWorkspace={isNoWorkspace}
      dragging={draggedSessionId === meta.sessionId}
      onSelectSession={onSelectSession}
      onEditMeta={setEditMeta}
      onCtxMenu={setCtxMenu}
      onDragStart={setDraggedSessionId}
      onDragEnd={() => setDraggedSessionId(null)}
    />
  )

  const makeDropZone = (groupId: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (draggedSessionId) { e.preventDefault(); setDragOverGroupId(groupId ?? 'ungrouped') } },
    onDragLeave: () => setDragOverGroupId(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); void handleDrop(groupId) },
  })

  return (
    <div className="flex flex-col h-full bg-brand-bg w-full">
      {/* Workspace dropdown */}
      <div className="flex-shrink-0 p-2 border-b border-brand-panel/60 relative" ref={dropdownRef}>
        <button onClick={() => setDropdownOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 rounded bg-brand-panel hover:bg-brand-panel/80 transition-colors text-left">
          <FolderOpen size={13} className="flex-shrink-0 text-zinc-500" />
          <span className="flex-1 text-xs text-zinc-300 truncate min-w-0">{workspaceLabel}</span>
          <ChevronDown size={12} className={cn('flex-shrink-0 text-zinc-500 transition-transform', dropdownOpen && 'rotate-180')} />
        </button>
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-brand-bg border border-brand-panel/60 rounded shadow-xl py-1 max-h-48 overflow-y-auto">
              <button onClick={() => { onProjectChange(null); setDropdownOpen(false) }} className={cn('w-full flex flex-col px-3 py-1.5 text-left transition-colors hover:bg-brand-panel', isNoWorkspace && 'bg-brand-panel/60')}>
                <span className="text-xs text-zinc-200">No Workspace</span>
                <span className="text-[10px] text-zinc-600">Plain sessions, no git required</span>
              </button>
              {openProjects.length > 0 && <div className="h-px bg-brand-panel my-1" />}
              {openProjects.map((p) => {
                const norm = p.replace(/\\/g, '/')
                return (
                  <button key={p} onClick={() => { onProjectChange(p); setDropdownOpen(false) }} className={cn('w-full flex flex-col px-3 py-1.5 text-left transition-colors hover:bg-brand-panel', norm === normalizedActive && 'bg-brand-panel/60')}>
                    <span className="text-xs text-zinc-200">{p.split('/').filter(Boolean).pop() ?? p}</span>
                    <span className="text-[10px] text-zinc-600">{shortPath(p)}</span>
                  </button>
                )
              })}
              <div className="h-px bg-brand-panel my-1" />
              <button onClick={() => { setDropdownOpen(false); addProject() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 hover:bg-brand-panel hover:text-zinc-300 transition-colors text-left">
                <Plus size={11} />Open Project
              </button>
            </div>
          </>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {projectSessions.length === 0 && isRestoringLayout && (
          <div className="flex flex-col gap-0.5 py-1">
            {[0.85, 0.65, 0.75].map((w, i) => (
              <div key={i} className="flex flex-col gap-1 px-3 py-2 border-l-2 border-transparent">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
                  <Skeleton className="h-2.5 rounded" style={{ width: `${w * 100}%` }} />
                </div>
                <Skeleton className="h-2 rounded ml-3.5" style={{ width: `${(w * 0.7) * 100}%` }} />
              </div>
            ))}
          </div>
        )}

        {projectSessions.length === 0 && !isRestoringLayout && (
          <p className="text-xs text-zinc-600 text-center mt-6 px-4">No sessions yet</p>
        )}

        {grouped ? (
          <>
            {/* Ungrouped drop zone */}
            <div
              {...makeDropZone(null)}
              className={cn('min-h-[4px] transition-colors', dragOverGroupId === 'ungrouped' && draggedSessionId && 'bg-brand-accent/10')}
            >
              {grouped.ungrouped.map(renderSessionRow)}
            </div>

            {/* Groups */}
            {sessionGroups.map((g) => (
              <div
                key={g.id}
                {...makeDropZone(g.id)}
                className={cn('transition-colors rounded-sm', dragOverGroupId === g.id && draggedSessionId && 'bg-brand-accent/10')}
              >
                <div className="group/grp flex items-center gap-1.5 px-3 pt-3 pb-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color ?? '#6366f1' }} />
                  <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider truncate">{g.name}</span>
                  <div className="flex-1 h-px bg-brand-panel/60" />
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDeleteGroup(g.id) }}
                    className="opacity-0 group-hover/grp:opacity-100 transition-opacity text-zinc-700 hover:text-red-400 flex-shrink-0"
                    title="Delete group"
                  >
                    <X size={11} />
                  </button>
                </div>
                {(grouped.byGroup[g.id] ?? []).length === 0
                  ? <p className="px-3 py-1.5 text-[10px] text-zinc-700 italic">Drag sessions here</p>
                  : (grouped.byGroup[g.id] ?? []).map(renderSessionRow)
                }
              </div>
            ))}
          </>
        ) : (
          projectSessions.map(renderSessionRow)
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
          <div className="fixed z-[9999] bg-brand-surface border border-brand-panel/60 rounded shadow-xl py-1 min-w-[160px]" style={{ left: Math.min(ctxMenu.x, window.innerWidth - 180), top: Math.min(ctxMenu.y, window.innerHeight - 100) }}>
            <button onMouseDown={(e) => { e.stopPropagation(); setEditMeta(ctxMenu.meta); setCtxMenu(null) }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors">
              <Pencil size={12} />Rename / Recolor
            </button>
            <div className="my-1 border-t border-brand-panel/60" />
            <button onMouseDown={(e) => { e.stopPropagation(); handleCloseSession(ctxMenu.meta); setCtxMenu(null) }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors">
              <X size={12} />Close Session
            </button>
          </div>
        </>,
        document.body
      )}

      {editMeta && <EditModal meta={editMeta} onSave={(name, color) => handleEditSave(editMeta, name, color)} onDismiss={() => setEditMeta(null)} />}

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-brand-panel/60 p-2">
        {footerMode === 'idle' && (
          isNoWorkspace ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => setFooterMode('newSession')}
                className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-muted transition-colors rounded"
              >
                <Plus size={13} />New Session
              </button>
              <button
                onClick={() => setFooterMode('newGroup')}
                className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-muted transition-colors rounded"
              >
                <Users size={12} />New Group
              </button>
            </div>
          ) : (
            <button onClick={() => setFooterMode('newSession')} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-muted transition-colors rounded">
              <Plus size={13} />New Task
            </button>
          )
        )}

        {footerMode === 'newGroup' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) resetFooter() }}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl w-72 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-200">New Group</span>
                <button onClick={resetFooter} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={14} /></button>
              </div>
              <input
                ref={nameInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !creating) void handleCreateGroup(); if (e.key === 'Escape') resetFooter() }}
                placeholder="group name"
                className="w-full bg-brand-panel border border-brand-panel/60 focus:border-brand-muted/50 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewGroupColor(c)} style={{ backgroundColor: c }} className={cn('w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0', newGroupColor === c && 'ring-2 ring-white ring-offset-2 ring-offset-brand-surface scale-110')} />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetFooter} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded">Cancel</button>
                <button onClick={() => void handleCreateGroup()} disabled={creating || !newGroupName.trim()} className="px-4 py-1.5 text-xs font-medium rounded bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {creating ? <Loader2 size={11} className="animate-spin inline" /> : 'Create'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {footerMode === 'newSession' && (
          <div className="flex flex-col gap-1.5">
            <input
              ref={nameInputRef}
              value={isNoWorkspace ? sessionName : taskName}
              onChange={(e) => isNoWorkspace ? setSessionName(e.target.value) : setTaskName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) void (isNoWorkspace ? handleCreateNoWorkspaceSession() : handleCreateWorkspaceSession())
                if (e.key === 'Escape') resetFooter()
              }}
              placeholder={isNoWorkspace ? 'session name' : 'task name (e.g. fix-auth)'}
              className="w-full bg-brand-panel border border-brand-panel/60 focus:border-brand-muted/50 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
            />
            {isNoWorkspace && (
              <>
                <button
                  type="button"
                  onClick={async () => { const picked = await ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null; if (picked !== null) setSessionDir(picked) }}
                  className="w-full flex items-center gap-2 bg-brand-panel border border-brand-panel/60 hover:border-brand-muted/40 rounded px-2 py-1.5 text-xs text-left transition-colors"
                >
                  <FolderOpen size={11} className="flex-shrink-0 text-zinc-500" />
                  <span className={sessionDir ? 'text-zinc-300 truncate' : 'text-zinc-600 truncate'}>{sessionDir || defaultSessionDir || '~/Orbit'}</span>
                </button>
                {sessionGroups.length > 0 && (
                  <select
                    value={sessionGroupId}
                    onChange={(e) => setSessionGroupId(e.target.value)}
                    className="w-full bg-brand-panel border border-brand-panel/60 focus:border-brand-muted/50 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="">No group</option>
                    {sessionGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </>
            )}
            <div className="flex gap-1.5">
              <button onClick={resetFooter} disabled={creating} className="flex-1 flex items-center justify-center py-1.5 text-xs text-zinc-500 hover:text-zinc-300 rounded border border-brand-panel/60 transition-colors disabled:opacity-40">Cancel</button>
              <button onClick={() => void (isNoWorkspace ? handleCreateNoWorkspaceSession() : handleCreateWorkspaceSession())} disabled={creating} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-zinc-200 hover:text-white bg-brand-panel hover:bg-brand-panel/80 rounded border border-brand-panel/60 transition-colors disabled:opacity-40">
                {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
