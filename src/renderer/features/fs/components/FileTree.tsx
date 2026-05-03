import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import { createPortal } from 'react-dom'
import { readDir, getGitStatus, renameEntry, trashEntry } from '../fs.service'
import { FileTreeContextMenu } from './FileTreeContextMenu'
import { useInstalledEditors } from '../hooks/useInstalledEditors'
import { cn } from '../../../lib/utils'
import type { FsEntry, GitStatusEntry } from '@shared/ipc-types'

function statusColor(xy: string): string {
  if (xy === '??') return 'text-green-400'
  if (xy[0] !== ' ' && xy[0] !== '?') return 'text-blue-400'
  if (xy[1] === 'M') return 'text-yellow-400'
  if (xy[1] === 'D') return 'text-red-400'
  return 'text-green-400'
}

function statusLabel(xy: string): string {
  if (xy === '??') return 'U'
  if (xy[0] !== ' ') return 'S'
  if (xy[1] === 'M') return 'M'
  if (xy[1] === 'D') return 'D'
  return 'A'
}

interface CtxTarget {
  x: number
  y: number
  entry: FsEntry
  rel: string
}

interface TreeNodeProps {
  entry: FsEntry
  depth: number
  gitMap: Map<string, string>
  projectRoot: string
  activeFilePath: string | null
  renamingPath: string | null
  onFileClick: (path: string, xy: string | undefined) => void
  onContextMenu: (e: React.MouseEvent, entry: FsEntry, rel: string) => void
  onRenameSubmit: (entry: FsEntry, newName: string) => void
  onRenameCancel: () => void
}

function TreeNode({ entry, depth, gitMap, projectRoot, activeFilePath, renamingPath, onFileClick, onContextMenu, onRenameSubmit, onRenameCancel }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FsEntry[] | null>(null)
  const [renameValue, setRenameValue] = useState(entry.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const isRenaming = renamingPath === entry.path

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(entry.name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, entry.name])

  const toggle = async (): Promise<void> => {
    if (!entry.isDirectory) {
      const rel = entry.path.replace(/\\/g, '/').replace(projectRoot, '').replace(/^\//, '')
      onFileClick(entry.path, gitMap.get(rel))
      return
    }
    if (!expanded && !children) {
      setChildren(await readDir(entry.path))
    }
    setExpanded((v) => !v)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      const trimmed = renameValue.trim()
      if (trimmed && trimmed !== entry.name) onRenameSubmit(entry, trimmed)
      else onRenameCancel()
    } else if (e.key === 'Escape') {
      onRenameCancel()
    }
  }

  const rel = entry.path.replace(/\\/g, '/').replace(projectRoot, '').replace(/^\//, '')
  const xy = gitMap.get(rel)
  const isActive = !entry.isDirectory && activeFilePath !== null &&
    entry.path.replace(/\\/g, '/') === activeFilePath.replace(/\\/g, '/')

  return (
    <>
      <div
        className={cn(
          'w-full flex items-center gap-1.5 py-1 text-left transition-colors rounded-sm group',
          isActive ? 'bg-brand-panel/60' : 'hover:bg-brand-panel/40'
        )}
        style={{ paddingLeft: `${10 + depth * 14}px`, paddingRight: 8 }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, entry, rel) }}
      >
        <button onClick={toggle} className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="flex-shrink-0 text-zinc-500 w-3.5">
            {entry.isDirectory ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
          </span>
          <span className="flex-shrink-0 text-zinc-400 w-4 flex items-center">
            {entry.isDirectory
              ? expanded ? <FolderOpen size={13} className="text-yellow-500/70" /> : <Folder size={13} className="text-yellow-500/70" />
              : <File size={13} />}
          </span>
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={() => onRenameCancel()}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-brand-panel border border-brand-green/50 rounded px-1 text-xs text-zinc-100 outline-none min-w-0"
            />
          ) : (
            <span className={cn('text-sm truncate flex-1', xy ? statusColor(xy) : 'text-zinc-300')}>
              {entry.name}
            </span>
          )}
        </button>
        {xy && !isRenaming && (
          <span className={cn('text-[10px] font-bold flex-shrink-0', statusColor(xy))}>
            {statusLabel(xy)}
          </span>
        )}
      </div>
      {expanded && children && children.map((child) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          gitMap={gitMap}
          projectRoot={projectRoot}
          activeFilePath={activeFilePath}
          renamingPath={renamingPath}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
        />
      ))}
    </>
  )
}

function DeleteConfirm({ entry, onConfirm, onCancel }: { entry: FsEntry; onConfirm: () => void; onCancel: () => void }): JSX.Element {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4">
        <span className="text-sm font-semibold text-zinc-200">Move to Trash</span>
        <p className="text-xs text-zinc-400">
          Move <span className="text-zinc-200 font-medium">{entry.name}</span> to the trash?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded border border-brand-panel hover:border-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 hover:text-red-300 transition-colors rounded"
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface Props {
  projectRoot: string
  activeFilePath?: string | null
  onFileClick: (path: string, xy: string | undefined) => void
  refreshTick?: number
}

export function FileTree({ projectRoot: rootProp, activeFilePath = null, onFileClick, refreshTick = 0 }: Props): JSX.Element {
  const [rootEntries, setRootEntries] = useState<FsEntry[]>([])
  const [gitMap, setGitMap] = useState<Map<string, string>>(new Map())
  const [ctxTarget, setCtxTarget] = useState<CtxTarget | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<FsEntry | null>(null)
  const editors = useInstalledEditors()

  const projectRoot = rootProp.replace(/\\/g, '/')

  const loadRoot = useCallback(async () => {
    if (!projectRoot) return
    setRootEntries(await readDir(projectRoot))
    const statuses = await getGitStatus(projectRoot)
    const map = new Map<string, string>()
    statuses.forEach((s: GitStatusEntry) => map.set(s.path.replace(/\\/g, '/'), s.xy))
    setGitMap(map)
  }, [projectRoot, refreshTick])

  useEffect(() => { loadRoot() }, [loadRoot])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FsEntry, rel: string) => {
    setCtxTarget({ x: e.clientX, y: e.clientY, entry, rel })
  }, [])

  const handleRenameSubmit = useCallback(async (entry: FsEntry, newName: string) => {
    setRenamingPath(null)
    try {
      await renameEntry(entry.path, newName)
      await loadRoot()
    } catch {}
  }, [loadRoot])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingEntry) return
    const entry = deletingEntry
    setDeletingEntry(null)
    try {
      await trashEntry(entry.path)
      await loadRoot()
    } catch {}
  }, [deletingEntry, loadRoot])

  if (!projectRoot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-zinc-600">No project selected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            gitMap={gitMap}
            projectRoot={projectRoot}
            activeFilePath={activeFilePath}
            renamingPath={renamingPath}
            onFileClick={onFileClick}
            onContextMenu={handleContextMenu}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingPath(null)}
          />
        ))}
      </div>

      {ctxTarget && (
        <FileTreeContextMenu
          x={ctxTarget.x}
          y={ctxTarget.y}
          entry={ctxTarget.entry}
          projectRoot={projectRoot}
          rel={ctxTarget.rel}
          editors={editors}
          onFileClick={onFileClick}
          onRename={() => setRenamingPath(ctxTarget.entry.path)}
          onDelete={() => setDeletingEntry(ctxTarget.entry)}
          onDismiss={() => setCtxTarget(null)}
        />
      )}

      {deletingEntry && (
        <DeleteConfirm
          entry={deletingEntry}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  )
}
