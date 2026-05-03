import { useState } from 'react'
import { X, FileText, GitBranch, RefreshCw, Palette } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { useFilePane, EXT_LANG } from '../hooks/useFilePane'
import { cn } from '../../../lib/utils'
import type { BundledTheme } from 'shiki'

interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}

interface Props {
  files: OpenFile[]
  activeFilePath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

export const VIEWER_THEMES: { id: BundledTheme; label: string }[] = [
  { id: 'vitesse-dark', label: 'Vitesse Dark' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'one-dark-pro', label: 'One Dark Pro' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha' },
  { id: 'ayu-dark', label: 'Ayu Dark' },
]

function classifyDiffLine(line: string): 'add' | 'remove' | 'hunk' | 'meta' | 'context' {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add'
  if (line.startsWith('-') && !line.startsWith('---')) return 'remove'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('+++') || line.startsWith('---')) return 'meta'
  return 'context'
}

interface PaneProps {
  file: OpenFile
  theme: BundledTheme
}

function FilePane({ file, theme }: PaneProps): JSX.Element {
  const allThemes = VIEWER_THEMES.map((t) => t.id)
  const { tab, setTab, html, diff, loading, ctxMenu, setCtxMenu, handleContextMenu, handleCopy, reload } = useFilePane(file, theme, allThemes)

  const diffLines = (diff ?? '').split('\n')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center h-8 px-3 border-b border-brand-panel gap-2 flex-shrink-0 bg-brand-surface/40">
        <button
          onClick={() => setTab('content')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            tab === 'content' ? 'bg-brand-panel text-brand-light' : 'text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50'
          )}
        >
          <FileText size={11} /> Content
        </button>
        {file.hasChanges && (
          <button
            onClick={() => setTab('diff')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              tab === 'diff' ? 'bg-brand-panel text-brand-light' : 'text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50'
            )}
          >
            <GitBranch size={11} /> Diff
          </button>
        )}
        <button onClick={reload} className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors" title="Refresh">
          <RefreshCw size={11} />
        </button>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-brand-surface border border-brand-panel rounded shadow-xl py-1 min-w-[120px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button onClick={handleCopy} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors">
            Copy
          </button>
        </div>
      )}

      <div className="file-content flex-1 overflow-auto font-mono text-sm leading-5 select-text cursor-text" onContextMenu={handleContextMenu}>
        {loading && <p className="text-zinc-500 px-4 py-3 text-xs">Loading…</p>}

        {!loading && tab === 'content' && html !== null && html !== '' && (
          <div className="shiki-wrap" dangerouslySetInnerHTML={{ __html: html }} />
        )}
        {!loading && tab === 'content' && html === '' && (
          <p className="text-zinc-500 px-4 py-3 text-xs">Empty file.</p>
        )}
        {!loading && tab === 'content' && html === null && (
          <p className="text-zinc-500 px-4 py-3 text-xs">Unable to load file.</p>
        )}

        {!loading && tab === 'diff' && (
          diffLines.length === 0 || (diffLines.length === 1 && !diffLines[0])
            ? <p className="text-zinc-500 px-4 py-3 text-xs">No diff available.</p>
            : diffLines.map((line, i) => {
                const type = classifyDiffLine(line)
                return (
                  <div key={i} className={cn('px-4 whitespace-pre',
                    type === 'add' && 'bg-green-950/50 text-green-300',
                    type === 'remove' && 'bg-red-950/50 text-red-300',
                    type === 'hunk' && 'text-brand-light bg-brand-panel/20',
                    type === 'meta' && 'text-zinc-500',
                    type === 'context' && 'text-zinc-400',
                  )}>{line || ' '}</div>
                )
              })
        )}
      </div>
    </div>
  )
}

export function FileViewer({ files, activeFilePath, onActivate, onClose }: Props): JSX.Element | null {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [showThemePicker, setShowThemePicker] = useState(false)

  if (files.length === 0) {
    return (
      <div className="flex flex-col bg-brand-bg w-full h-full items-center justify-center">
        <p className="text-sm text-zinc-600">Click a file in the tree to open it</p>
      </div>
    )
  }

  const activeFile = files.find((f) => f.path === activeFilePath) ?? files[0]
  const currentTheme = (VIEWER_THEMES.some((t) => t.id === settings.fileViewerTheme)
    ? settings.fileViewerTheme
    : 'vitesse-dark') as BundledTheme

  return (
    <div className="flex flex-col bg-brand-bg w-full h-full">
      <div className="flex items-center justify-end h-8 px-3 border-b border-brand-panel bg-brand-surface/40 flex-shrink-0">
        <div className="relative">
          <button onClick={() => setShowThemePicker((v) => !v)} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="Change theme">
            <Palette size={13} />
          </button>
          {showThemePicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-brand-surface border border-brand-panel rounded shadow-xl py-1 min-w-[160px]">
              {VIEWER_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { updateSettings({ fileViewerTheme: t.id }); setShowThemePicker(false) }}
                  className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', t.id === currentTheme ? 'text-brand-light bg-brand-panel' : 'text-zinc-300 hover:bg-brand-panel')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <FilePane key={activeFile.path} file={activeFile} theme={currentTheme} />
    </div>
  )
}
