import { useEffect, useState } from 'react'
import { X, RefreshCw, FileText, GitBranch } from 'lucide-react'
import { getGitDiff, readFile } from '../features/fs/fs.service'
import { cn } from '../lib/utils'

interface Props {
  projectRoot: string
  filePath: string
  hasChanges: boolean
  onClose: () => void
}

function classifyLine(line: string): 'add' | 'remove' | 'hunk' | 'meta' | 'context' {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add'
  if (line.startsWith('-') && !line.startsWith('---')) return 'remove'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('+++') || line.startsWith('---')) return 'meta'
  return 'context'
}

export function DiffView({ projectRoot, filePath, hasChanges, onClose }: Props): JSX.Element {
  const [tab, setTab] = useState<'content' | 'diff'>(hasChanges ? 'diff' : 'content')
  const [content, setContent] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const shortName = filePath.replace(/\\/g, '/').split('/').pop()
  const rel = filePath.replace(/\\/g, '/').replace(projectRoot.replace(/\\/g, '/'), '').replace(/^\//, '')

  const load = async (): Promise<void> => {
    setLoading(true)
    if (tab === 'content') {
      setContent(await readFile(filePath))
    } else {
      setDiff(await getGitDiff(projectRoot, rel))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filePath, tab])

  const lines = tab === 'content'
    ? (content ?? '').split('\n')
    : (diff ?? '').split('\n')

  return (
    <div className="flex flex-col border-t border-zinc-800 bg-zinc-950" style={{ height: '38%', minHeight: 140, flexShrink: 0 }}>
      <div className="flex items-center h-7 px-3 border-b border-zinc-800 flex-shrink-0 gap-2">
        <span className="text-xs font-mono text-zinc-300 truncate flex-1">{shortName}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setTab('content')} className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors', tab === 'content' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>
            <FileText size={10} /> Content
          </button>
          {hasChanges && (
            <button onClick={() => setTab('diff')} className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors', tab === 'diff' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300')}>
              <GitBranch size={10} /> Diff
            </button>
          )}
        </div>
        <button onClick={load} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="Refresh"><RefreshCw size={10} /></button>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={12} /></button>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        {loading && <p className="text-zinc-500 px-3 py-2">Loading…</p>}
        {!loading && !lines[0] && <p className="text-zinc-500 px-3 py-2">Empty file</p>}
        {!loading && lines.map((line, i) => {
          if (tab === 'diff') {
            const type = classifyLine(line)
            return (
              <div key={i} className={cn('px-3 whitespace-pre',
                type === 'add' && 'bg-green-950/50 text-green-300',
                type === 'remove' && 'bg-red-950/50 text-red-300',
                type === 'hunk' && 'text-violet-400 bg-violet-950/20',
                type === 'meta' && 'text-zinc-500',
                type === 'context' && 'text-zinc-400'
              )}>{line || ' '}</div>
            )
          }
          return (
            <div key={i} className="flex">
              <span className="w-10 flex-shrink-0 text-right pr-3 text-zinc-600 select-none border-r border-zinc-800 mr-3">{i + 1}</span>
              <span className="text-zinc-300 whitespace-pre">{line}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
