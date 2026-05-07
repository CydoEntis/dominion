import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { marked } from 'marked'
import { useStore } from '../store/root.store'
import { cn } from '../lib/utils'
import type { Note } from '@shared/ipc-types'

const NOTE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#14b8a6', '#f59e0b']

function noteColorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length]
}

function noteTitle(note: Note): string {
  const first = note.content.split('\n').find(l => l.trim())
  return first?.trim().slice(0, 40) || 'Untitled'
}

interface Props {
  activeNoteId: string | null
  onActivate: (id: string) => void
  onCreate: () => void
}

export function NoteEditor({ activeNoteId, onActivate, onCreate }: Props): JSX.Element {
  const notes = useStore((s) => s.notes)
  const saveNote = useStore((s) => s.saveNote)
  const deleteNote = useStore((s) => s.deleteNote)

  const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)
  const activeNote = notes.find(n => n.id === activeNoteId) ?? sorted[0] ?? null
  const effectiveId = activeNote?.id ?? null

  const [displayContent, setDisplayContent] = useState(activeNote?.content ?? '')
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('raw')
  const localContentRef = useRef(activeNote?.content ?? '')
  const prevIdRef = useRef<string | null>(effectiveId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSave = useCallback((id: string, content: string): void => {
    saveNote(id, content)
  }, [saveNote])

  useEffect(() => {
    if (prevIdRef.current !== effectiveId) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (prevIdRef.current) flushSave(prevIdRef.current, localContentRef.current)
      prevIdRef.current = effectiveId
      const content = activeNote?.content ?? ''
      localContentRef.current = content
      setDisplayContent(content)
      setViewMode('raw')
    }
  }, [effectiveId, flushSave])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Alt+R → raw, Alt+P → preview
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setViewMode('raw') }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setViewMode('preview') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const previewHtml = useMemo(() => {
    if (viewMode !== 'preview') return ''
    try {
      const html = marked.parse(displayContent) as string
      // Remove disabled so task-list checkboxes are clickable
      return html.replace(/(<input[^>]*?) disabled(="")?/g, '$1')
    } catch { return '' }
  }, [viewMode, displayContent])

  // Click handler for interactive task-list checkboxes in preview
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLInputElement
    if (target.tagName !== 'INPUT' || target.type !== 'checkbox') return
    e.preventDefault()

    const container = e.currentTarget
    const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]'))
    const idx = boxes.indexOf(target)
    if (idx === -1) return

    // Toggle the idx-th [ ] / [x] marker in the raw markdown
    const TASK_RE = /^(\s*[-*+] \[)([xX ]?)(\])/gm
    let count = 0
    const updated = localContentRef.current.replace(TASK_RE, (_, pre, mark, post) => {
      const result = count === idx
        ? `${pre}${mark.toLowerCase() === 'x' ? ' ' : 'x'}${post}`
        : `${pre}${mark}${post}`
      count++
      return result
    })

    if (updated === localContentRef.current) return
    localContentRef.current = updated
    setDisplayContent(updated)
    if (effectiveId) flushSave(effectiveId, updated)
  }, [effectiveId, flushSave])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    localContentRef.current = value
    setDisplayContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { if (effectiveId) flushSave(effectiveId, value) }, 400)
  }

  const handleDelete = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    deleteNote(id)
  }

  const btnBase = 'inline-flex items-center px-2 h-5 text-[10px] rounded transition-colors'

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-brand-bg">
        <p className="text-sm text-zinc-500">No notes yet</p>
        <button onClick={onCreate} className="px-3 py-1.5 text-xs rounded bg-brand-panel text-zinc-300 hover:text-zinc-100 transition-colors">
          New Note
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-brand-bg">
      <div
        className="flex items-center h-[52px] border-b border-brand-panel bg-brand-bg flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto h-full">
          {sorted.map(note => {
            const nc = noteColorFromId(note.id)
            const isActive = note.id === effectiveId
            return (
            <div
              key={note.id}
              onClick={() => onActivate(note.id)}
              style={{
                borderTopColor: isActive ? nc : 'transparent',
                background: isActive ? `linear-gradient(to right, ${nc}2e, transparent)` : undefined,
              }}
              className={cn(
                'flex items-center gap-2 px-4 h-full text-xs cursor-pointer flex-shrink-0 border-r border-brand-panel/40 group border-t-2',
                isActive ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/30'
              )}
            >
              <span className="max-w-[140px] truncate">{noteTitle(note)}</span>
              <button
                onClick={(e) => handleDelete(note.id, e)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-all flex-shrink-0"
                title="Delete note"
              >
                <X size={10} />
              </button>
            </div>
            )
          })}
          <button
            onClick={onCreate}
            className="flex items-center justify-center w-10 h-full text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/30 transition-colors flex-shrink-0"
            title="New note (Ctrl+N)"
          >
            <Plus size={14} />
          </button>
        </div>

        {activeNote && (
          <div className="flex items-center gap-1 px-3 flex-shrink-0 border-l border-brand-panel/40 h-full">
            <button
              onClick={() => setViewMode('raw')}
              className={cn(btnBase, viewMode === 'raw' ? 'bg-brand-panel text-brand-muted' : 'text-zinc-600 hover:text-zinc-300')}
            >
              Raw
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(btnBase, viewMode === 'preview' ? 'bg-brand-panel text-brand-muted' : 'text-zinc-600 hover:text-zinc-300')}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {activeNote && viewMode === 'preview' && (
        <div className="flex-1 overflow-auto select-text cursor-text">
          {previewHtml
            ? <div className="markdown-body px-8 py-6" dangerouslySetInnerHTML={{ __html: previewHtml }} onClick={handlePreviewClick} />
            : <p className="text-zinc-500 text-xs px-8 py-6">Nothing to preview.</p>
          }
        </div>
      )}

      {activeNote && viewMode === 'raw' && (
        <textarea
          value={displayContent}
          onChange={handleChange}
          placeholder="Start typing..."
          className="flex-1 w-full bg-transparent text-zinc-200 text-sm resize-none outline-none px-8 py-6 placeholder-zinc-600 leading-relaxed"
          spellCheck={false}
          autoFocus
        />
      )}
    </div>
  )
}
