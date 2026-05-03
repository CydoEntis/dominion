import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import { readDir, getGitStatus } from '../fs.service'
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

interface TreeNodeProps {
  entry: FsEntry
  depth: number
  gitMap: Map<string, string>
  projectRoot: string
  onFileClick: (path: string, xy: string | undefined) => void
}

function TreeNode({ entry, depth, gitMap, projectRoot, onFileClick }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FsEntry[] | null>(null)

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

  const rel = entry.path.replace(/\\/g, '/').replace(projectRoot, '').replace(/^\//, '')
  const xy = gitMap.get(rel)

  return (
    <>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 py-1 hover:bg-brand-panel/40 text-left transition-colors rounded-sm"
        style={{ paddingLeft: `${10 + depth * 14}px`, paddingRight: 8 }}
      >
        <span className="flex-shrink-0 text-zinc-500 w-3.5">
          {entry.isDirectory ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </span>
        <span className="flex-shrink-0 text-zinc-400 w-4 flex items-center">
          {entry.isDirectory
            ? expanded ? <FolderOpen size={13} className="text-yellow-500/70" /> : <Folder size={13} className="text-yellow-500/70" />
            : <File size={13} />}
        </span>
        <span className={cn('text-sm truncate flex-1', xy ? statusColor(xy) : 'text-zinc-300')}>
          {entry.name}
        </span>
        {xy && (
          <span className={cn('text-[10px] font-bold flex-shrink-0', statusColor(xy))}>
            {statusLabel(xy)}
          </span>
        )}
      </button>
      {expanded && children && children.map((child) => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} gitMap={gitMap} projectRoot={projectRoot} onFileClick={onFileClick} />
      ))}
    </>
  )
}

interface Props {
  projectRoot: string
  onFileClick: (path: string, xy: string | undefined) => void
  refreshTick?: number
}

export function FileTree({ projectRoot: rootProp, onFileClick, refreshTick = 0 }: Props): JSX.Element {
  const [rootEntries, setRootEntries] = useState<FsEntry[]>([])
  const [gitMap, setGitMap] = useState<Map<string, string>>(new Map())

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
          <TreeNode key={entry.path} entry={entry} depth={0} gitMap={gitMap} projectRoot={projectRoot} onFileClick={onFileClick} />
        ))}
      </div>
    </div>
  )
}
