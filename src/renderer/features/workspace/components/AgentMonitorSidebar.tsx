import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, ChevronRight, FolderOpen, X, Users, Columns2 } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { useLayoutDnd } from '../../layout/dnd/LayoutDndContext'
import { useProjects } from '../../session/hooks/useProjects'
import { patchSession, killSession } from '../../session/session.service'
import { EditSessionModal } from '../../session/components/EditSessionModal'
import { EditGroupModal } from '../../session/components/EditGroupModal'
import { removeWorktree } from '../../fs/fs.service'
import { detachTab, reattachTab, moveToWindow } from '../../window/window.service'
import { findTabForSession, collectSessionIds, findNotesLeafId, makeNotesLeaf } from '../../layout/layout-tree'
import { useWorktreeStats } from '../hooks/useWorktreeStats'
import { useConfirmClose } from '../../session/hooks/useConfirmClose'
import { FileTree } from '../../notes/components/FileTree'
import { toast } from 'sonner'
import { cn, normalizePath, shortPath } from '../../../lib/utils'
import { Skeleton } from '../../../components/ui/skeleton'
import { SessionRow } from './SessionRow'
import { SessionCtxMenu } from './SessionCtxMenu'
import { GroupCtxMenu } from './GroupCtxMenu'
import { NewGroupModal } from './NewGroupModal'
import { ConfirmCloseProjectModal } from './ConfirmCloseProjectModal'
import type { SessionMeta } from '@shared/ipc-types'

interface Props {
  activeProject: string | null
  onProjectChange: (path: string | null) => void
  activeSessionId: string | null
  onSelectSession: (id: string | null) => void
}

export function AgentMonitorSidebar({ activeProject, onProjectChange, activeSessionId, onSelectSession }: Props): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const tabOrder = useStore((s) => s.tabOrder)
  const isRestoringLayout = useStore((s) => s.isRestoringLayout)
  const isMainWindow = useStore((s) => s.isMainWindow)
  const windowId = useStore((s) => s.windowId)
  const upsertSession = useStore((s) => s.upsertSession)
  const removeTab = useStore((s) => s.removeTab)
  const detachPane = useStore((s) => s.detachPane)
  const paneTree = useStore((s) => s.paneTree)
  const openGroupInSplits = useStore((s) => s.openGroupInSplits)
  const focusedSessionId = useStore((s) => s.focusedSessionId)
  const setFocusedSession = useStore((s) => s.setFocusedSession)
  const addTab = useStore((s) => s.addTab)
  const insertLayoutAtRight = useStore((s) => s.insertLayoutAtRight)
  const sessionGroups = useStore((s) => s.settings.sessionGroups)
  const updateSettings = useStore((s) => s.updateSettings)

  const { startDrag, endDrag } = useLayoutDnd()
  const { openProjects, addProject, removeProject } = useProjects()
  const { requestClose, modal: closeModal } = useConfirmClose()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmCloseProject, setConfirmCloseProject] = useState(false)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; meta: SessionMeta } | null>(null)
  const [editMeta, setEditMeta] = useState<SessionMeta | null>(null)
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; group: { id: string; name: string; color?: string } } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; color?: string } | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null | 'ungrouped'>('ungrouped')
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const [splitPercent, setSplitPercent] = useState(50)
  const [sidebarActiveNoteId, setSidebarActiveNoteId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const sidebarBodyRef = useRef<HTMLDivElement>(null)

  const isNoWorkspace = activeProject === null
  const normalizedActive = activeProject ? normalizePath(activeProject) : undefined

  const currentWindowSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tabId of tabOrder) {
      const tree = paneTree[tabId]
      if (tree) collectSessionIds(tree).forEach((id) => ids.add(id))
    }
    return ids
  }, [tabOrder, paneTree])

  const projectSessions: SessionMeta[] = useMemo(() =>
    Object.values(sessions)
      .filter((m) => {
        if (!currentWindowSessionIds.has(m.sessionId)) return false
        if (isNoWorkspace) return !m.worktreePath
        if (!normalizedActive) return false
        const root = normalizePath(m.projectRoot ?? m.cwd)
        return (root === normalizedActive || root.startsWith(normalizedActive + '/')) && !!m.worktreePath
      })
      .sort((a, b) => b.createdAt - a.createdAt),
    [sessions, currentWindowSessionIds, isNoWorkspace, normalizedActive]
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
    setShowNewGroupModal(false)
  }, [normalizedActive, isNoWorkspace])

  useEffect(() => {
    if (!isNoWorkspace && projectSessions.length > 0 && (!activeSessionId || activeSessionId === '__root__')) {
      onSelectSession(projectSessions[0].sessionId)
    }
  }, [projectSessions.length, activeSessionId, isNoWorkspace, onSelectSession])

  useEffect(() => {
    setSidebarActiveNoteId(null)
    const handler = (e: Event): void => {
      const { noteId, tabId } = (e as CustomEvent<{ noteId: string; tabId: string }>).detail
      if (tabId === activeSessionId) setSidebarActiveNoteId(noteId)
    }
    document.addEventListener('acc:note-active-changed', handler)
    return () => document.removeEventListener('acc:note-active-changed', handler)
  }, [activeSessionId])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const body = sidebarBodyRef.current
    if (!body) return
    const bodyRect = body.getBoundingClientRect()
    const onMove = (ev: MouseEvent): void => {
      const relY = ev.clientY - bodyRect.top
      setSplitPercent(Math.min(80, Math.max(20, (relY / bodyRect.height) * 100)))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleSidebarNoteActivate = useCallback((noteId: string): void => {
    const s = useStore.getState()
    // activeSessionId may be a secondary session inside a split pane tab.
    // findTabForSession traverses all pane trees to find the correct tab key.
    const tabId = (activeSessionId ? findTabForSession(s.paneTree, activeSessionId) : null) ?? '__root__'
    const tree = s.paneTree[tabId]
    if (!tree) return

    if (tree.type === 'leaf' && tree.panel === 'home') {
      const newLeaf = makeNotesLeaf(noteId)
      s.replaceLayoutLeaf(tabId, tree.id, newLeaf)
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('acc:activate-note', { detail: { noteId, tabId, leafId: newLeaf.id } }))
      }, 50)
      return
    }

    // Use findNotesLeafId (any notes pane) to avoid inserting a duplicate when
    // a notes pane already exists but was opened without a specific noteId.
    const existingLeafId = findNotesLeafId(tree)
    if (existingLeafId) {
      document.dispatchEvent(new CustomEvent('acc:activate-note', { detail: { noteId, tabId, leafId: existingLeafId } }))
      return
    }

    const newLeaf = makeNotesLeaf(noteId)
    insertLayoutAtRight(tabId, newLeaf)
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('acc:activate-note', { detail: { noteId, tabId, leafId: newLeaf.id } }))
    }, 50)
  }, [activeSessionId, insertLayoutAtRight])

  const handleNewNote = useCallback((): void => {
    if (activeSessionId) {
      const state = useStore.getState()
      const tree = state.paneTree[activeSessionId]
      if (tree && !findNotesLeafId(tree)) state.toggleNotesPane(activeSessionId)
    }
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('acc:new-note'))
    }, 50)
  }, [activeSessionId])

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

  const handleCloseSession = useCallback((meta: SessionMeta) => {
    requestClose(async () => {
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
    })
  }, [requestClose, activeSessionId, isNoWorkspace, normalizedActive, removeTab, onSelectSession])

  const handleCloseAllSplits = useCallback(async (meta: SessionMeta) => {
    if (!meta.groupId) return
    const splits = projectSessions.filter((s) => s.groupId === meta.groupId && /^Split #\d+$/.test(s.name))
    for (const split of splits) {
      try { await killSession(split.sessionId) } catch {}
      removeTab(split.sessionId)
    }
  }, [projectSessions, removeTab])

  const handleEditSave = useCallback(async (meta: SessionMeta, name: string, color: string) => {
    try { const patched = await patchSession({ sessionId: meta.sessionId, name, color }); upsertSession(patched) } catch {}
    setEditMeta(null)
  }, [upsertSession])

  const handleEditGroupSave = useCallback(async (groupId: string, name: string, color: string) => {
    const updated = (sessionGroups ?? []).map((g) => g.id === groupId ? { ...g, name, color } : g)
    try { await updateSettings({ sessionGroups: updated }) } catch {}
    setEditingGroup(null)
  }, [sessionGroups, updateSettings])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    const sessionsInGroup = projectSessions.filter((s) => s.groupId === groupId)
    await Promise.all(sessionsInGroup.map((s) =>
      patchSession({ sessionId: s.sessionId, groupId: null }).then((p) => upsertSession(p)).catch(() => {})
    ))
    await updateSettings({ sessionGroups: sessionGroups.filter((g) => g.id !== groupId) })
  }, [projectSessions, sessionGroups, updateSettings, upsertSession])

  const handleOpenGroupAsLayout = useCallback((groupId: string): void => {
    const sessionIds = projectSessions.filter((s) => s.groupId === groupId).map((s) => s.sessionId)
    if (sessionIds.length > 0) openGroupInSplits(sessionIds)
  }, [projectSessions, openGroupInSplits])

  const handleCreateGroup = useCallback(async (name: string, color: string): Promise<void> => {
    const id = crypto.randomUUID()
    await updateSettings({ sessionGroups: [...sessionGroups, { id, name, color }] })
    toast.success(`Group "${name}" created`)
  }, [sessionGroups, updateSettings])

  const handleDetach = useCallback((sessionId: string): void => {
    if (!windowId) return
    const tabId = findTabForSession(useStore.getState().paneTree, sessionId) ?? sessionId
    detachPane(tabId, sessionId)
    void detachTab(sessionId, windowId)
    if (activeSessionId === sessionId) onSelectSession(null)
  }, [detachPane, windowId, activeSessionId, onSelectSession])

  const handleReattach = useCallback((sessionId: string): void => {
    void reattachTab(sessionId, windowId ?? undefined)
  }, [windowId])

  const handleMoveToWindow = useCallback((sessionId: string, targetWindowId: string): void => {
    const tabId = findTabForSession(useStore.getState().paneTree, sessionId) ?? sessionId
    detachPane(tabId, sessionId)
    void moveToWindow(sessionId, targetWindowId)
  }, [detachPane])

  const handleSplitHere = useCallback((sessionId: string): void => {
    if (!activeSessionId) return
    openGroupInSplits([activeSessionId, sessionId])
  }, [activeSessionId, openGroupInSplits])

  const workspaceLabel = isNoWorkspace ? 'No Workspace'
    : normalizedActive ? normalizedActive.split('/').filter(Boolean).pop() ?? normalizedActive
    : 'No Workspace'

  const effectiveActiveId = useMemo(() => {
    if (!activeSessionId || !focusedSessionId) return activeSessionId
    const tree = paneTree[activeSessionId]
    if (tree && collectSessionIds(tree).includes(focusedSessionId)) return focusedSessionId
    return activeSessionId
  }, [activeSessionId, focusedSessionId, paneTree])

  const handleSessionSelect = useCallback((sessionId: string): void => {
    const tabId = findTabForSession(paneTree, sessionId)
    if (tabId) {
      onSelectSession(tabId)
      setFocusedSession(sessionId)
    } else {
      // Session exists but has no pane (closed pane, not killed) — re-open it in its own tab.
      addTab(sessionId)
    }
  }, [paneTree, onSelectSession, setFocusedSession, addTab])

  const renderSessionRow = (meta: SessionMeta): JSX.Element => (
    <SessionRow
      key={meta.sessionId}
      meta={meta}
      activeSessionId={effectiveActiveId}
      worktreeStats={worktreeStats}
      isNoWorkspace={isNoWorkspace}
      dragging={draggedSessionId === meta.sessionId}
      onSelectSession={() => handleSessionSelect(meta.sessionId)}
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

  const sessionListContent = (
    <>
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
          <div
            {...makeDropZone(null)}
            className={cn('min-h-[4px] transition-colors', dragOverGroupId === 'ungrouped' && draggedSessionId && 'bg-brand-accent/10')}
          >
            {grouped.ungrouped.map(renderSessionRow)}
          </div>

          {sessionGroups.map((g) => {
            const isCollapsed = collapsedGroups.has(g.id)
            const groupSessions = grouped.byGroup[g.id] ?? []
            const splitChildren = groupSessions.filter((s) => /^Split #\d+$/.test(s.name))
            const isSplitGroup = splitChildren.length > 0
            const displaySessions = isSplitGroup
              ? groupSessions.filter((s) => !/^Split #\d+$/.test(s.name))
              : groupSessions
            const splitPaneCount = isSplitGroup ? groupSessions.length : undefined
            const toggleCollapsed = (): void => setCollapsedGroups((prev) => {
              const next = new Set(prev)
              if (next.has(g.id)) next.delete(g.id)
              else next.add(g.id)
              return next
            })
            return (
              <div
                key={g.id}
                {...makeDropZone(g.id)}
                className={cn('transition-colors rounded-sm', dragOverGroupId === g.id && draggedSessionId && 'bg-brand-accent/10')}
              >
                <div
                  className="flex items-center gap-2 px-2 py-2 mx-1 rounded cursor-pointer select-none hover:bg-brand-panel/50 transition-colors"
                  onClick={toggleCollapsed}
                  onContextMenu={(e) => { e.preventDefault(); setGroupCtxMenu({ x: e.clientX, y: e.clientY, group: g }) }}
                >
                  <ChevronRight
                    size={12}
                    className={cn('flex-shrink-0 text-zinc-600 transition-transform duration-150', !isCollapsed && 'rotate-90')}
                  />
                  <span className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: g.color ?? '#6366f1', borderRadius: '3px' }} />
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider truncate flex-1">{g.name}</span>
                  {isCollapsed && displaySessions.length > 0 && (
                    <span className="text-[10px] text-zinc-600 font-medium tabular-nums flex-shrink-0">{displaySessions.length}</span>
                  )}
                </div>
                {!isCollapsed && (
                  displaySessions.length === 0
                    ? <p className="px-7 pb-1.5 text-[10px] text-zinc-700 italic">Drag sessions here</p>
                    : <div className="ml-5 border-l border-zinc-800">
                        {displaySessions.map((meta) => (
                          <SessionRow
                            key={meta.sessionId}
                            meta={meta}
                            activeSessionId={effectiveActiveId}
                            worktreeStats={worktreeStats}
                            isNoWorkspace={isNoWorkspace}
                            dragging={draggedSessionId === meta.sessionId}
                            onSelectSession={() => handleSessionSelect(meta.sessionId)}
                            onEditMeta={setEditMeta}
                            onCtxMenu={setCtxMenu}
                            onDragStart={setDraggedSessionId}
                            onDragEnd={() => setDraggedSessionId(null)}
                            paneCount={splitPaneCount}
                          />
                        ))}
                      </div>
                )}
              </div>
            )
          })}
        </>
      ) : (
        projectSessions.map(renderSessionRow)
      )}
    </>
  )

  return (
    <div className="flex flex-col h-full bg-brand-bg w-full">
      {/* Workspace dropdown */}
      <div className="flex-shrink-0 p-2 border-b border-brand-panel/60 relative" ref={dropdownRef}>
        <div className="flex items-center gap-1">
          <button onClick={() => setDropdownOpen((v) => !v)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded bg-brand-panel hover:bg-brand-panel/80 transition-colors text-left min-w-0">
            <FolderOpen size={13} className="flex-shrink-0 text-zinc-500" />
            <span className="flex-1 text-xs text-zinc-300 truncate min-w-0">{workspaceLabel}</span>
            <ChevronDown size={12} className={cn('flex-shrink-0 text-zinc-500 transition-transform', dropdownOpen && 'rotate-180')} />
          </button>
          {!isNoWorkspace && (
            <button
              onClick={() => setConfirmCloseProject(true)}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
              title="Close project"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-brand-bg border border-brand-panel/60 rounded shadow-xl py-1 max-h-48 overflow-y-auto">
              <button onClick={() => { setDropdownOpen(false); addProject() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 hover:bg-brand-panel hover:text-zinc-300 transition-colors text-left">
                <Plus size={11} />Open Project
              </button>
              <div className="h-px bg-brand-panel my-1" />
              <button onClick={() => { onProjectChange(null); setDropdownOpen(false) }} className={cn('w-full flex flex-col px-3 py-1.5 text-left transition-colors hover:bg-brand-panel', isNoWorkspace && 'bg-brand-panel/60')}>
                <span className="text-xs text-zinc-200">No Workspace</span>
                <span className="text-[10px] text-zinc-600">Plain sessions, no git required</span>
              </button>
              {openProjects.length > 0 && <div className="h-px bg-brand-panel my-1" />}
              {openProjects.map((p) => {
                const norm = p.replace(/\\/g, '/')
                return (
                  <div key={p} className="group relative flex items-center">
                    <button onClick={() => { onProjectChange(p); setDropdownOpen(false) }} className={cn('flex-1 flex flex-col px-3 py-1.5 text-left transition-colors hover:bg-brand-panel', norm === normalizedActive && 'bg-brand-panel/60')}>
                      <span className="text-xs text-zinc-200">{p.split('/').filter(Boolean).pop() ?? p}</span>
                      <span className="text-[10px] text-zinc-600">{shortPath(p)}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); void removeProject(p); setDropdownOpen(false) }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-600 hover:text-red-400"
                      title="Remove project"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Body: Sessions section + Notes section */}
      <div className="flex flex-col flex-1 min-h-0" ref={sidebarBodyRef}>

        {/* Sessions section */}
        <div
          className={cn('flex flex-col min-h-0', !sessionsOpen && 'flex-shrink-0')}
          style={sessionsOpen
            ? (notesOpen ? { flex: `0 0 ${splitPercent}%` } : { flex: '1 1 0' })
            : undefined}
        >
          <div
            className="flex-shrink-0 flex items-center gap-0.5 px-3 py-1.5 border-b border-brand-panel/40 cursor-pointer hover:bg-brand-panel/30 transition-colors select-none"
            onClick={() => setSessionsOpen((v) => !v)}
          >
            <ChevronRight
              size={10}
              className={cn('flex-shrink-0 text-zinc-600 transition-transform duration-150', sessionsOpen && 'rotate-90')}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 flex-1">Sessions</span>
            {sessionsOpen && (isNoWorkspace ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); document.dispatchEvent(new CustomEvent('acc:new-session')) }}
                  className="p-1 text-zinc-600 hover:text-zinc-300 rounded hover:bg-brand-panel/60 transition-colors"
                  title="New Session"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNewGroupModal(true) }}
                  className="p-1 text-zinc-600 hover:text-zinc-300 rounded hover:bg-brand-panel/60 transition-colors"
                  title="New Group"
                >
                  <Users size={12} />
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); document.dispatchEvent(new CustomEvent('acc:new-task', { detail: { projectPath: activeProject } })) }}
                className="p-1 text-zinc-600 hover:text-zinc-300 rounded hover:bg-brand-panel/60 transition-colors"
                title="New Task"
              >
                <Plus size={12} />
              </button>
            ))}
          </div>

          {sessionsOpen && (
            <div className="flex-1 overflow-y-auto min-h-0 py-1">
              {sessionListContent}
            </div>
          )}
        </div>

        {/* Resize handle — only when both sections open */}
        {notesOpen && sessionsOpen && (
          <div
            className="h-1 flex-shrink-0 bg-brand-panel/60 hover:bg-brand-accent transition-colors cursor-row-resize"
            onMouseDown={handleResizeMouseDown}
          />
        )}

        {/* Notes section */}
        <div className={cn('flex flex-col flex-shrink-0', notesOpen && 'flex-1 min-h-0')}>
          <div
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-t border-brand-panel/40 cursor-pointer hover:bg-brand-panel/30 transition-colors select-none"
            onClick={() => setNotesOpen((v) => !v)}
          >
            <ChevronRight
              size={10}
              className={cn('flex-shrink-0 text-zinc-600 transition-transform duration-150', notesOpen && 'rotate-90')}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 flex-1">Notes</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleNewNote() }}
              className="p-1 text-zinc-600 hover:text-zinc-300 rounded hover:bg-brand-panel/60 transition-colors"
              title="New Note (Ctrl+Shift+N)"
            >
              <Plus size={12} />
            </button>
          </div>

          {notesOpen && (
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <div className="absolute inset-0">
                <FileTree
                  activeNoteId={sidebarActiveNoteId}
                  onActivate={handleSidebarNoteActivate}
                  onCreate={handleNewNote}
                  onNoteDragStart={(noteId) => startDrag({ type: 'sidebar-notes', noteId })}
                  onNoteDragEnd={endDrag}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {ctxMenu && (
        <SessionCtxMenu
          ctxMenu={ctxMenu}
          onDismiss={() => setCtxMenu(null)}
          onRename={setEditMeta}
          onSplitHere={handleSplitHere}
          onDetach={handleDetach}
          onReattach={handleReattach}
          onCloseAllSplits={handleCloseAllSplits}
          onKill={handleCloseSession}
          onMoveToWindow={handleMoveToWindow}
          activeSessionId={activeSessionId}
          paneTree={paneTree}
          isMainWindow={isMainWindow}
          windowId={windowId}
          projectSessions={projectSessions}
        />
      )}

      {editMeta && (
        <EditSessionModal
          meta={editMeta}
          onSave={(name, color) => handleEditSave(editMeta, name, color)}
          onDismiss={() => setEditMeta(null)}
        />
      )}

      {groupCtxMenu && (
        <GroupCtxMenu
          groupCtxMenu={groupCtxMenu}
          onDismiss={() => setGroupCtxMenu(null)}
          onEdit={setEditingGroup}
          onDelete={(id) => void handleDeleteGroup(id)}
          onOpenAsLayout={handleOpenGroupAsLayout}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onSave={(name, color) => void handleEditGroupSave(editingGroup.id, name, color)}
          onDismiss={() => setEditingGroup(null)}
        />
      )}

      {closeModal}

      {confirmCloseProject && activeProject && (
        <ConfirmCloseProjectModal
          workspaceLabel={workspaceLabel}
          onClose={() => setConfirmCloseProject(false)}
          onConfirm={() => {
            setConfirmCloseProject(false)
            void removeProject(activeProject).then(() => onProjectChange(null))
          }}
        />
      )}

      {showNewGroupModal && (
        <NewGroupModal
          onDismiss={() => setShowNewGroupModal(false)}
          onSave={handleCreateGroup}
        />
      )}
    </div>
  )
}
