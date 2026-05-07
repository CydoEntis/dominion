import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, Loader2, Plus, Terminal } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { FileTree } from '../../fs/components/FileTree'
import { useProjects } from '../../session/hooks/useProjects'
import { createSession } from '../../session/session.service'
import { cn } from '../../../lib/utils'

const DEFAULT_COLOR = '#22c55e'

interface Props {
  activeProject: string | null
  onProjectChange: (path: string | null) => void
  onFileClick: (path: string, xy: string | undefined) => void
  activeFilePath: string | null
  focusedSessionId: string | null
  onFocusSession: (sessionId: string) => void
}

export function WorkspaceSidebar({
  activeProject,
  onProjectChange,
  onFileClick,
  activeFilePath,
  focusedSessionId,
  onFocusSession,
}: Props): JSX.Element {
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const { openProjects, addProject, refreshTicks } = useProjects()

  const projectName = activeProject
    ? (activeProject.split(/[\\/]/).pop() ?? activeProject)
    : 'Select Project'

  const norm = (p: string): string => p.replace(/\\/g, '/')

  const projectSessions = Object.values(sessions).filter((s) => {
    if (!activeProject) return false
    return s.cwd && norm(s.cwd).startsWith(norm(activeProject))
  })

  const handleNewSession = async (): Promise<void> => {
    if (!activeProject || creating) return
    setCreating(true)
    try {
      const name = activeProject.split(/[\\/]/).pop() ?? 'session'
      const meta = await createSession({ name, agentCommand: 'claude', cwd: activeProject, cols: 80, rows: 24 })
      upsertSession(meta)
      addTab(meta.sessionId)
      onFocusSession(meta.sessionId)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-brand-bg overflow-hidden select-none">
      {/* Project switcher */}
      <div className="relative flex-shrink-0 border-b border-brand-panel/40">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-brand-panel/30 transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderOpen size={13} className="text-brand-accent flex-shrink-0" />
            <span className="truncate">{projectName}</span>
          </div>
          <ChevronDown
            size={12}
            className={cn('text-zinc-500 flex-shrink-0 transition-transform duration-150', dropdownOpen && 'rotate-180')}
          />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-0 right-0 z-50 bg-brand-surface border border-brand-panel/60 shadow-xl rounded-b-md py-1 max-h-64 overflow-y-auto">
              {openProjects.length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-600">No projects open</p>
              )}
              {openProjects.map((p) => {
                const name = p.split(/[\\/]/).pop() ?? p
                return (
                  <button
                    key={p}
                    onClick={() => { onProjectChange(p); setDropdownOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left',
                      norm(activeProject ?? '') === norm(p)
                        ? 'text-zinc-200 bg-brand-panel/40'
                        : 'text-zinc-400 hover:bg-brand-panel hover:text-zinc-200'
                    )}
                  >
                    <FolderOpen size={11} className="flex-shrink-0 text-zinc-500" />
                    <span className="truncate">{name}</span>
                  </button>
                )
              })}
              <div className="h-px bg-brand-panel/40 my-1" />
              <button
                onClick={() => { addProject(); setDropdownOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 hover:bg-brand-panel hover:text-zinc-300 transition-colors text-left"
              >
                <Plus size={11} className="flex-shrink-0" />
                Open Project
              </button>
            </div>
          </>
        )}
      </div>

      {/* Collapsible sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Explorer */}
        <div>
          <button
            onClick={() => setExplorerOpen((v) => !v)}
            className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {explorerOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Explorer
          </button>

          {explorerOpen && (
            activeProject
              ? (
                <div className="pb-1">
                  <FileTree
                    projectRoot={activeProject}
                    onFileClick={onFileClick}
                    activeFilePath={activeFilePath}
                    refreshTick={refreshTicks[norm(activeProject)] ?? 0}
                  />
                </div>
              )
              : (
                <p className="px-4 py-2 text-[11px] text-zinc-600">No project selected</p>
              )
          )}
        </div>

        {/* Sessions */}
        <div>
          <div className="flex items-center px-2 py-1 group">
            <button
              onClick={() => setSessionsOpen((v) => !v)}
              className="flex items-center gap-1 flex-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {sessionsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Sessions
              {projectSessions.length > 0 && (
                <span className="ml-1 text-zinc-600 font-normal normal-case tracking-normal">
                  {projectSessions.length}
                </span>
              )}
            </button>
            {activeProject && (
              <button
                onClick={handleNewSession}
                disabled={creating}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-40"
                title="New session in this project"
              >
                {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              </button>
            )}
          </div>

          {sessionsOpen && (
            <div className="pb-2">
              {projectSessions.length === 0 ? (
                <p className="px-4 py-2 text-[11px] text-zinc-600">
                  {activeProject ? 'No sessions — click + to create one' : 'Select a project first'}
                </p>
              ) : (
                projectSessions.map((session) => {
                  const isFocused = focusedSessionId === session.sessionId
                  const color = session.color ?? DEFAULT_COLOR
                  const isRunning = session.status === 'running'
                  const agentStatus = session.agentStatus ?? 'idle'

                  return (
                    <button
                      key={session.sessionId}
                      onClick={() => onFocusSession(session.sessionId)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all text-left border-l-2"
                      style={{
                        borderLeftColor: isFocused ? color : 'transparent',
                        background: `linear-gradient(to right, ${color}${isFocused ? '2e' : '12'}, transparent)`,
                      }}
                    >
                      {isRunning && agentStatus === 'running' ? (
                        <Loader2 size={11} className="flex-shrink-0 animate-spin" style={{ color }} />
                      ) : (
                        <span
                          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', agentStatus === 'waiting-input' && isRunning && 'animate-pulse')}
                          style={{ backgroundColor: isRunning ? color : '#52525b' }}
                        />
                      )}
                      <span className={cn('text-xs truncate flex-1 min-w-0', isFocused ? 'text-zinc-100 font-medium' : 'text-zinc-400')}>
                        {session.name}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
