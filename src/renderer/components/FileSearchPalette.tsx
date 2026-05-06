import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, FolderOpen, FileText } from 'lucide-react'
import { findFiles } from '../features/fs/fs.service'
import { useStore } from '../store/root.store'
import { cn } from '../lib/utils'

type Stage = 'project' | 'files'

interface Props {
  open: boolean
  onClose: () => void
  onOpenFile: (path: string) => void
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const lower = text.replace(/\\/g, '/').toLowerCase()
  return query.toLowerCase().split(/\s+/).every((term) => lower.includes(term))
}

function projectName(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
}

function fileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function relPath(path: string, root: string): string {
  const norm = path.replace(/\\/g, '/')
  const normRoot = root.replace(/\\/g, '/')
  return norm.startsWith(normRoot) ? norm.slice(normRoot.length).replace(/^\//, '') : norm
}

export function FileSearchPalette({ open, onClose, onOpenFile }: Props): JSX.Element | null {
  const openProjects = useStore((s) => s.settings.openProjects)

  const [stage, setStage] = useState<Stage>('project')
  const [project, setProject] = useState<string | null>(null)
  const [fileList, setFileList] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStage('project')
      setProject(null)
      setQuery('')
      setSelectedIdx(0)
      setFileList([])
      loadedFor.current = null
      return
    }
    if (openProjects.length === 1) {
      setProject(openProjects[0])
      setStage('files')
    } else {
      setStage('project')
      setProject(null)
    }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, openProjects])

  useEffect(() => {
    if (!project || loadedFor.current === project) return
    loadedFor.current = project
    setLoading(true)
    setFileList([])
    findFiles(project).then((files) => {
      setFileList(files)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [project])

  useEffect(() => { setSelectedIdx(0) }, [query, stage])

  const filteredProjects = openProjects.filter((p) => fuzzyMatch(projectName(p), query))
  const filteredFiles = fileList.filter((f) => fuzzyMatch(f, query))
  const items = stage === 'project' ? filteredProjects : filteredFiles
  const clampedIdx = Math.min(selectedIdx, Math.max(items.length - 1, 0))

  const selectProject = useCallback((p: string) => {
    setProject(p)
    setStage('files')
    setQuery('')
    setSelectedIdx(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const confirm = useCallback((path: string) => {
    onOpenFile(path)
    onClose()
  }, [onOpenFile, onClose])

  const goBack = useCallback(() => {
    setStage('project')
    setProject(null)
    setQuery('')
    setSelectedIdx(0)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Backspace' && query === '' && stage === 'files' && openProjects.length > 1) {
      goBack(); return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, items.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      if (stage === 'project' && filteredProjects[clampedIdx]) selectProject(filteredProjects[clampedIdx])
      else if (stage === 'files' && filteredFiles[clampedIdx]) confirm(filteredFiles[clampedIdx])
    }
  }, [query, stage, openProjects.length, items.length, filteredProjects, filteredFiles, clampedIdx, selectProject, confirm, goBack, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[15vh]"
      onMouseDown={() => onClose()}
    >
      <div
        className="bg-brand-surface border border-brand-panel/80 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-brand-panel">
          {stage === 'files' && project && (
            <button
              onClick={openProjects.length > 1 ? goBack : undefined}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0 transition-colors',
                openProjects.length > 1
                  ? 'bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 cursor-pointer'
                  : 'bg-brand-panel/60 text-zinc-400 cursor-default'
              )}
            >
              <FolderOpen size={10} />
              {projectName(project)}
            </button>
          )}
          <Search size={14} className="text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={stage === 'project' ? 'Search projects…' : 'Search files…'}
            className="bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none flex-1"
          />
          <kbd className="text-[10px] text-zinc-600 border border-brand-panel rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1.5">
          {/* Project stage */}
          {stage === 'project' && openProjects.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">No projects open — add one from the Projects sidebar</p>
          )}
          {stage === 'project' && openProjects.length > 0 && filteredProjects.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">No projects match</p>
          )}
          {stage === 'project' && filteredProjects.map((p, idx) => (
            <button
              key={p}
              onClick={() => selectProject(p)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
                idx === clampedIdx ? 'bg-brand-accent/20 text-zinc-100' : 'text-zinc-300 hover:bg-brand-panel/60'
              )}
            >
              <FolderOpen size={12} className="text-zinc-500 flex-shrink-0" />
              <span className="flex-1 truncate font-medium">{projectName(p)}</span>
              <span className="text-[10px] text-zinc-600 flex-shrink-0 truncate max-w-[220px]">
                {p.replace(/\\/g, '/')}
              </span>
            </button>
          ))}

          {/* Files stage */}
          {stage === 'files' && loading && (
            <p className="text-xs text-zinc-500 text-center py-8">Scanning files…</p>
          )}
          {stage === 'files' && !loading && filteredFiles.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">No files match</p>
          )}
          {stage === 'files' && !loading && filteredFiles.map((path, idx) => (
            <button
              key={path}
              onClick={() => confirm(path)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                idx === clampedIdx ? 'bg-brand-accent/20 text-zinc-100' : 'text-zinc-300 hover:bg-brand-panel/60'
              )}
            >
              <FileText size={12} className="text-zinc-500 flex-shrink-0" />
              <span className="flex-1 truncate">{fileName(path)}</span>
              <span className="text-[10px] text-zinc-600 flex-shrink-0 truncate max-w-[220px]">
                {project ? relPath(path, project) : path}
              </span>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        {stage === 'files' && openProjects.length > 1 && (
          <div className="px-4 py-2 border-t border-brand-panel/40 text-[10px] text-zinc-600">
            Backspace to switch project
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
