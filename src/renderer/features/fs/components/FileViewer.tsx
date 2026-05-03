import { useStore } from '../../../store/root.store'
import { useFilePane, EXT_LANG } from '../hooks/useFilePane'
import { MarkdownPane } from './MarkdownPane'
import { cn } from '../../../lib/utils'
import type { BundledTheme } from 'shiki'
import type { FilePaneTab } from '../hooks/useFilePane'

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
  tab: FilePaneTab
  onTabChange: (t: FilePaneTab) => void
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
  tab: FilePaneTab
  onTabChange: (t: FilePaneTab) => void
}

function FilePane({ file, theme, tab, onTabChange }: PaneProps): JSX.Element {
  const allThemes = VIEWER_THEMES.map((t) => t.id)
  const { html, diff, loading, ctxMenu, setCtxMenu, handleContextMenu, handleCopy } = useFilePane(file, theme, allThemes, tab, onTabChange)

  const diffLines = (diff ?? '').split('\n')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {tab === 'preview' && <MarkdownPane filePath={file.path} />}

      {tab !== 'preview' && (
        <>
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
        </>
      )}
    </div>
  )
}

export function FileViewer({ files, activeFilePath, tab, onTabChange }: Props): JSX.Element | null {
  const settings = useStore((s) => s.settings)

  if (files.length === 0) {
    return (
      <div className="flex flex-col bg-brand-bg flex-1 min-h-0 items-center justify-center">
        <p className="text-sm text-zinc-600">Click a file in the tree to open it</p>
      </div>
    )
  }

  const activeFile = files.find((f) => f.path === activeFilePath) ?? files[0]
  const currentTheme = (VIEWER_THEMES.some((t) => t.id === settings.fileViewerTheme)
    ? settings.fileViewerTheme
    : 'vitesse-dark') as BundledTheme

  return (
    <div className="flex flex-col bg-brand-bg flex-1 min-h-0">
      <FilePane key={activeFile.path} file={activeFile} theme={currentTheme} tab={tab} onTabChange={onTabChange} />
    </div>
  )
}
