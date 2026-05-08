import { useState } from 'react'
import { RefreshCw, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { getGitDiff } from '../../fs/fs.service'
import type { GitFileInfo } from '../../fs/fs.service'
import type { UseGitReviewReturn } from '../hooks/useGitReview'
import { cn } from '../../../lib/utils'

interface Props {
  projectRoot: string | null
  gitReview: UseGitReviewReturn
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

function dirpart(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(0, idx) : ''
}

interface FileRowProps {
  info: GitFileInfo | string
  projectRoot: string
}

function FileRow({ info, projectRoot }: FileRowProps): JSX.Element {
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffText, setDiffText] = useState<string | null>(null)

  const isUntracked = typeof info === 'string'
  const filePath = isUntracked ? info : info.path
  const added = isUntracked ? 0 : info.added
  const deleted = isUntracked ? 0 : info.deleted

  const toggleDiff = async (): Promise<void> => {
    if (isUntracked) return
    if (diffOpen) { setDiffOpen(false); return }
    setDiffLoading(true)
    const text = await getGitDiff(projectRoot, filePath)
    setDiffText(text)
    setDiffLoading(false)
    setDiffOpen(true)
  }

  const dotColor = isUntracked ? '#22c55e' : deleted > 0 && added === 0 ? '#ef4444' : '#eab308'

  return (
    <div className="flex flex-col">
      <div
        onClick={toggleDiff}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 hover:bg-brand-panel/40 transition-colors min-w-0',
          !isUntracked && 'cursor-pointer select-none'
        )}
      >
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="text-sm text-zinc-200 truncate flex-1 min-w-0">
          {basename(filePath)}
          {dirpart(filePath) && <span className="text-xs text-zinc-600 ml-1.5">{dirpart(filePath)}</span>}
        </span>
        {!isUntracked && (added > 0 || deleted > 0) && (
          <span className="flex items-center gap-1 flex-shrink-0 text-xs font-mono">
            {added > 0 && <span className="text-green-400">+{added}</span>}
            {deleted > 0 && <span className="text-red-400">-{deleted}</span>}
          </span>
        )}
        {diffLoading && <Loader2 size={12} className="animate-spin text-zinc-500 flex-shrink-0" />}
      </div>
      {diffOpen && diffText && (
        <div className="mx-3 mb-2 rounded overflow-auto max-h-64 bg-brand-panel/30 border border-brand-panel/40">
          <pre className="text-xs font-mono leading-4 p-2 select-text">
            {diffText.split('\n').map((line, i) => (
              <span key={i} className={cn('block',
                line.startsWith('+') && !line.startsWith('+++') && 'bg-green-950/50 text-green-300',
                line.startsWith('-') && !line.startsWith('---') && 'bg-red-950/50 text-red-300',
                line.startsWith('@@') && 'text-zinc-500',
                !line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') && 'text-zinc-400',
              )}>
                {line || ' '}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, count, defaultOpen = true, children }: SectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors text-left border-b border-brand-panel/30"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {title}
        <span className="ml-auto text-zinc-600">{count}</span>
      </button>
      {open && children}
    </div>
  )
}

export function GitReviewPanel({ projectRoot, gitReview }: Props): JSX.Element {
  const { data, loading, refresh } = gitReview

  const allChanges: (GitFileInfo | string)[] = data
    ? [...data.staged, ...data.unstaged, ...data.untracked]
    : []

  return (
    <div className="bg-brand-bg border-l border-brand-panel/60 flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center px-3 h-10 border-b border-brand-panel/60 flex-shrink-0 gap-2">
        <span className="text-xs font-semibold text-zinc-400 flex-1">Changes</span>
        <button onClick={refresh} disabled={loading} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0" title="Refresh">
          <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {!projectRoot && <p className="text-sm text-zinc-600 text-center mt-8 px-4">No project selected</p>}

        {projectRoot && data && (
          <>
            {allChanges.length > 0 && (
              <Section title="Changes" count={allChanges.length}>
                {allChanges.map((f, i) => (
                  <FileRow key={i} info={f} projectRoot={projectRoot} />
                ))}
              </Section>
            )}

            {allChanges.length === 0 && (
              <p className="text-sm text-zinc-600 text-center mt-8 px-4">Working tree clean</p>
            )}
          </>
        )}

        {projectRoot && !data && !loading && (
          <p className="text-sm text-zinc-600 text-center mt-8 px-4">No changes</p>
        )}
      </div>
    </div>
  )
}
