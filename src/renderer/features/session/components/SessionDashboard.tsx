import { useState } from 'react'
import { X, FolderOpen, FolderClosed, Plus, Terminal, RefreshCw } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { findTabForSession } from '../../terminal/pane-tree'
import { FileTree } from '../../fs/components/FileTree'
import { useProjects } from '../hooks/useProjects'
import { createSession } from '../session.service'
import { cn } from '../../../lib/utils'

interface ProjectSectionProps {
  path: string
  name: string
  refreshTick: number
  onFileClick: (path: string, xy: string | undefined) => void
  onNewSession: () => void
  onRefresh: () => void
  onRemove: () => void
}

function ProjectSection({ path, name, refreshTick, onFileClick, onNewSession, onRefresh, onRemove }: ProjectSectionProps): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="group flex items-center gap-1.5 px-2 py-1.5 border-b border-brand-panel/60 cursor-pointer hover:bg-brand-panel/20 transition-colors">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 flex-1 min-w-0">
          {expanded ? <FolderOpen size={13} className="text-brand-light flex-shrink-0" /> : <FolderClosed size={13} className="text-zinc-500 flex-shrink-0" />}
          <span className="text-xs font-semibold text-zinc-200 truncate">{name}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onNewSession() }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-brand-light transition-colors" title="New session"><Terminal size={11} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRefresh() }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-colors" title="Refresh"><RefreshCw size={11} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-colors" title="Remove"><X size={11} /></button>
      </div>
      {expanded && <FileTree projectRoot={path} onFileClick={onFileClick} refreshTick={refreshTick} />}
    </div>
  )
}

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

interface Props {
  onFileClick: (path: string, xy: string | undefined) => void
  activeTab: 'sessions' | 'projects'
}

export function SessionDashboard({ onFileClick, activeTab }: Props): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const paneTree = useStore((s) => s.paneTree)
  const focusedSessionId = useStore((s) => s.focusedSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const setFocusedSession = useStore((s) => s.setFocusedSession)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)

  const { openProjects, refreshTicks, bumpRefresh, addProject, removeProject, closeSession } = useProjects()

  const allSessions = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="flex flex-col w-56 h-full bg-brand-bg border-r border-brand-panel flex-shrink-0">
      {/* Sessions tab */}
      {activeTab === 'sessions' && (
        <div className="flex-1 overflow-y-auto py-1">
          {allSessions.length === 0 && (
            <p className="text-xs text-zinc-600 text-center mt-6">No sessions</p>
          )}
          {allSessions.map((m) => {
            const tabId = findTabForSession(paneTree, m.sessionId)
            const isRunning = m.status === 'running'
            const isFocused = focusedSessionId === m.sessionId
            return (
              <div
                key={m.sessionId}
                className={cn(
                  'group w-full flex flex-col gap-0.5 px-3 py-2 transition-colors border-l-2',
                  tabId ? 'cursor-pointer' : 'opacity-30 cursor-default',
                  isFocused ? 'bg-brand-panel border-l-brand-green' : 'border-l-transparent hover:bg-brand-surface'
                )}
                onClick={() => { if (tabId) { setActiveSession(tabId); setFocusedSession(m.sessionId) } }}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                    isRunning ? isFocused ? 'bg-green-400 animate-pulse' : 'bg-green-600' : 'bg-zinc-600'
                  )} />
                  <span className={cn('text-xs font-medium truncate flex-1', isFocused ? 'text-zinc-100' : 'text-zinc-500')}>
                    {m.name}
                  </span>
                  <span className={cn('text-[10px] flex-shrink-0', isFocused ? 'text-zinc-400' : 'text-zinc-700')}>
                    {timeAgo(m.createdAt)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeSession(m.sessionId) }}
                    className="flex-shrink-0 text-zinc-700 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100 ml-0.5"
                    title="Close session"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className={cn('pl-3.5 text-[10px] truncate', isFocused ? 'text-zinc-400' : 'text-zinc-600')}>
                  {shortPath(m.cwd)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Projects tab */}
      {activeTab === 'projects' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {openProjects.length === 0 ? (
            <button
              onClick={addProject}
              className="w-full flex items-center justify-center gap-2 py-4 text-xs text-zinc-600 hover:text-brand-light transition-colors"
            >
              <Plus size={12} /> Open a project
            </button>
          ) : (
            <>
              {openProjects.map((p) => {
                const name = p.split('/').filter(Boolean).pop() ?? p
                return (
                  <ProjectSection
                    key={p}
                    path={p}
                    name={name}
                    refreshTick={refreshTicks[p] ?? 0}
                    onFileClick={onFileClick}
                    onNewSession={async () => {
                      try {
                        const meta = await createSession({ name, agentCommand: 'claude', cwd: p, cols: 80, rows: 24 })
                        upsertSession(meta)
                        addTab(meta.sessionId)
                        updateSettings({ projectRoot: p })
                      } catch {}
                    }}
                    onRefresh={() => bumpRefresh(p)}
                    onRemove={() => removeProject(p)}
                  />
                )
              })}
              <button
                onClick={addProject}
                className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-zinc-700 hover:text-brand-light transition-colors border-t border-brand-panel/50"
              >
                <Plus size={10} /> Add project
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
