import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Columns2, Rows2, ExternalLink, Copy, Clipboard, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { useTerminal } from '../hooks/useTerminal'
import { FileViewer } from '../../fs/components/FileViewer'
import { useStore } from '../../../store/root.store'
import { cn } from '../../../lib/utils'
import type { FilePaneTab } from '../../fs/hooks/useFilePane'

const EMPTY_FILES: string[] = []
const DEFAULT_COLOR = '#22c55e'
const DIFF_LINE_RE = /^\s{2,}(\d+) ([+\- ])(.*)$/

const CTX_ICONS: Record<string, JSX.Element> = {
  'Copy': <Copy size={12} />,
  'Paste': <Clipboard size={12} />,
  'Open URL': <ExternalLink size={12} />,
}

const PANE_ICONS: Record<string, JSX.Element> = {
  'Split Horizontal': <Columns2 size={12} />,
  'Split Vertical': <Rows2 size={12} />,
  'Detach to Window': <ExternalLink size={12} />,
  'Close Pane': <X size={12} />,
}

interface PaneItem { label: string; action: () => void }

interface Props {
  sessionId: string
  paneItems?: PaneItem[]
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

function shortDir(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : parts.join('/')
}

function SessionDiffView({ patch }: { patch: string }): JSX.Element {
  const lines = patch.split('\n')
  return (
    <div className="flex-1 overflow-auto font-mono text-sm leading-5 select-text">
      {lines.map((line, i) => {
        const m = line.match(DIFF_LINE_RE)
        if (m) {
          const type = m[2] === '+' ? 'add' : m[2] === '-' ? 'remove' : 'context'
          return (
            <div key={i} className={cn('flex gap-2 px-3 whitespace-pre',
              type === 'add' && 'bg-green-950/50',
              type === 'remove' && 'bg-red-950/50',
            )}>
              <span className="text-zinc-600 select-none w-8 text-right flex-shrink-0 text-xs leading-5">{m[1]}</span>
              <span className={cn('flex-shrink-0 text-xs leading-5',
                type === 'add' && 'text-green-400',
                type === 'remove' && 'text-red-400',
                type === 'context' && 'text-zinc-600',
              )}>{m[2]}</span>
              <span className={cn(
                type === 'add' && 'text-green-300',
                type === 'remove' && 'text-red-300',
                type === 'context' && 'text-zinc-400',
              )}>{m[3]}</span>
            </div>
          )
        }
        if (line.trim()) {
          return (
            <div key={i} className="px-3 py-0.5 text-[10px] text-zinc-500 border-b border-brand-panel/30">
              {line.trim()}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export function TerminalPane({ sessionId, paneItems }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { ctxMenu, dismissCtxMenu, search } = useTerminal(sessionId, containerRef)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (search.visible) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    } else {
      setSearchTerm('')
    }
  }, [search.visible])

  const touchedFiles = useStore((s) => s.touchedFiles[sessionId] ?? EMPTY_FILES)
  const touchedFilePatches = useStore((s) => s.touchedFilePatches[sessionId])
  const clearTouchedFiles = useStore((s) => s.clearTouchedFiles)
  const sessionCwd = useStore((s) => s.sessions[sessionId]?.cwd ?? '')
  const sessionColor = useStore((s) => s.sessions[sessionId]?.color ?? DEFAULT_COLOR)

  const [showList, setShowList] = useState(false)
  const [overlayPath, setOverlayPath] = useState<string | null>(null)
  const [overlayTab, setOverlayTab] = useState<FilePaneTab>('content')

  const openFile = (path: string): void => {
    setOverlayPath(path)
    setOverlayTab('content')
    setShowList(false)
  }

  const btnBase = 'px-2 py-0.5 text-[10px] rounded transition-colors'
  const sessionPatch = overlayPath ? (touchedFilePatches?.[overlayPath] ?? null) : null

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="xterm-container"
        style={{ width: '100%', height: '100%', padding: '4px 8px' }}
      />

      {search.visible && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-brand-surface border border-brand-panel/80 rounded-md shadow-xl px-2 py-1">
          <Search size={11} className="text-zinc-500 flex-shrink-0" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              if (e.target.value) search.findNext(e.target.value)
              else searchInputRef.current && (searchInputRef.current.value = '')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) search.findNext(searchTerm)
              else if (e.key === 'Enter' && e.shiftKey) search.findPrevious(searchTerm)
              else if (e.key === 'Escape') search.hide()
            }}
            placeholder="Find in terminal…"
            className="w-48 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
          <button onClick={() => search.findPrevious(searchTerm)} title="Previous (Shift+Enter)" className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5">
            <ChevronUp size={12} />
          </button>
          <button onClick={() => search.findNext(searchTerm)} title="Next (Enter)" className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5">
            <ChevronDown size={12} />
          </button>
          <button onClick={search.hide} className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 ml-0.5">
            <X size={11} />
          </button>
        </div>
      )}

      {touchedFiles.length > 0 && (
        <div className="absolute top-2 right-3 z-10">
          <button
            onClick={() => setShowList((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded-full bg-brand-surface/90 border border-brand-panel/60 text-zinc-400 hover:text-zinc-200 hover:border-brand-panel transition-colors backdrop-blur-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sessionColor }} />
            {touchedFiles.length} file{touchedFiles.length !== 1 ? 's' : ''}
          </button>

          {showList && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowList(false)} />
              <div className="absolute top-full right-0 mt-1 z-[9999] bg-brand-surface border border-brand-panel/60 rounded-lg shadow-xl py-1 w-[300px] max-h-[320px] overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-panel/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Touched files</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearTouchedFiles(sessionId); setShowList(false) }}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {touchedFiles.map((path) => (
                  <button
                    key={path}
                    onClick={() => openFile(path)}
                    className="w-full text-left px-3 py-2 hover:bg-brand-panel/60 transition-colors group"
                  >
                    <div className="text-xs text-zinc-200 group-hover:text-zinc-100 truncate">{basename(path)}</div>
                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">{shortDir(path)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {overlayPath && (
        <div className="absolute inset-y-0 right-0 z-20 flex flex-col bg-brand-bg border-l border-brand-panel w-[480px] max-w-[60%]">
          <div className="flex items-center gap-2 px-3 h-8 border-b border-brand-panel flex-shrink-0">
            <span className="text-xs text-zinc-400 truncate flex-1" title={overlayPath}>{basename(overlayPath)}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setOverlayTab('content')}
                className={cn(btnBase, overlayTab === 'content' ? 'bg-brand-panel text-zinc-200' : 'text-zinc-600 hover:text-zinc-400')}
              >
                Raw
              </button>
              <button
                onClick={() => setOverlayTab('diff')}
                className={cn(btnBase, overlayTab === 'diff' ? 'bg-brand-panel text-zinc-200' : 'text-zinc-600 hover:text-zinc-400')}
              >
                Diff
              </button>
            </div>
            <button
              onClick={() => setOverlayPath(null)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 ml-1"
            >
              <X size={13} />
            </button>
          </div>

          {overlayTab === 'diff' && sessionPatch ? (
            <SessionDiffView patch={sessionPatch} />
          ) : overlayTab === 'diff' && !sessionPatch ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-zinc-600">No session changes captured for this file.</p>
            </div>
          ) : (
            <FileViewer
              files={[{ path: overlayPath, root: sessionCwd, hasChanges: false }]}
              activeFilePath={overlayPath}
              onActivate={() => {}}
              onClose={() => setOverlayPath(null)}
              tab="content"
              onTabChange={() => {}}
            />
          )}
        </div>
      )}

      {ctxMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={dismissCtxMenu}
            onContextMenu={(e) => { e.preventDefault(); dismissCtxMenu() }}
          />
          <div
            className="fixed z-[9999] bg-brand-surface border border-brand-panel/60 rounded shadow-xl py-1 min-w-[140px]"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {ctxMenu.items.map((item, i) => (
              <button key={i} onMouseDown={(e) => { e.stopPropagation(); item.action(); dismissCtxMenu() }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors">
                <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">{CTX_ICONS[item.label]}</span>
                {item.label}
              </button>
            ))}
            {paneItems && paneItems.length > 0 && (
              <>
                <div className="my-1 border-t border-brand-panel/60" />
                {paneItems.map((item, i) => (
                  <button key={i} onMouseDown={(e) => { e.stopPropagation(); item.action(); dismissCtxMenu() }}
                    className={cn('w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-brand-panel transition-colors',
                      item.label === 'Close Pane' ? 'text-red-400 hover:text-red-300' : 'text-zinc-300 hover:text-zinc-100'
                    )}>
                    <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">{PANE_ICONS[item.label]}</span>
                    {item.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
