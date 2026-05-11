import { useState, useRef, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import { useStore } from '../store/root.store'
import { FileTree, noteTitle } from '../features/notes/components/FileTree'

export interface NoteDrawerProps {
  onClose: () => void
  activeNoteId: string | null
  onActivate: (id: string) => void
  onCreate: () => void
  onOpenPreview?: () => void
}

export function NoteDrawer({ onClose, activeNoteId, onActivate, onCreate, onOpenPreview }: NoteDrawerProps): JSX.Element {
  const notes = useStore((s) => s.notes)
  const saveNote = useStore((s) => s.saveNote)

  const activeNote = notes.find(n => n.id === activeNoteId)
    ?? notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
    ?? null

  const [showTree, setShowTree] = useState(false)
  const [treeWidth, setTreeWidth] = useState(240)
  const [editorMode, setEditorMode] = useState<'raw' | 'split' | 'preview'>('raw')

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        e.stopPropagation()
        setShowTree((v) => !v)
      }
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        e.stopPropagation()
        setEditorMode((m) => m === 'split' ? 'raw' : 'split')
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [])

  const [displayContent, setDisplayContent] = useState(activeNote?.content ?? '')
  const localContentRef = useRef(activeNote?.content ?? '')
  const prevIdRef = useRef<string | null>(activeNote?.id ?? null)
  const effectiveIdRef = useRef<string | null>(activeNote?.id ?? null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const flushSave = useCallback((id: string, content: string): void => {
    saveNote(id, content)
  }, [saveNote])

  useEffect(() => { effectiveIdRef.current = activeNote?.id ?? null }, [activeNote?.id])

  useEffect(() => {
    const eid = activeNote?.id ?? null
    if (prevIdRef.current !== eid) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (prevIdRef.current && dirtyRef.current) flushSave(prevIdRef.current, localContentRef.current)
      dirtyRef.current = false
      prevIdRef.current = eid
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    const content = activeNote?.content ?? ''
    localContentRef.current = content
    setDisplayContent(content)
  }, [activeNote?.id, activeNote?.content, flushSave])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (effectiveIdRef.current && dirtyRef.current) flushSave(effectiveIdRef.current, localContentRef.current)
  }, [flushSave])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    localContentRef.current = value
    dirtyRef.current = true
    setDisplayContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const eid = effectiveIdRef.current
    debounceRef.current = setTimeout(() => { if (eid) flushSave(eid, value) }, 400)
  }

  return (
    <div
      className="flex h-full w-full bg-brand-bg"
    >
      {/* File tree — slides in on the left */}
      {showTree && (
        <>
          <div style={{ width: treeWidth }} className="flex-shrink-0 flex flex-col min-h-0">
            <FileTree
              activeNoteId={activeNoteId}
              onActivate={onActivate}
              onCreate={onCreate}
            />
          </div>
          <div
            className="w-1 flex-shrink-0 bg-zinc-700 hover:bg-brand-accent transition-colors"
            style={{ cursor: 'col-resize' }}
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = treeWidth
              const onMove = (ev: MouseEvent): void => {
                setTreeWidth(Math.min(520, Math.max(160, startWidth + ev.clientX - startX)))
              }
              const onUp = (): void => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          />
        </>
      )}

      {/* Editor */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
        {/* Header */}
        <div className="flex items-center px-3 h-10 border-b border-brand-panel flex-shrink-0 gap-2">
          <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">
            {activeNote ? noteTitle(activeNote) : 'Notes'}
          </span>
        </div>

        {/* Editor body */}
        {notes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-zinc-600">No notes yet</p>
            <button onClick={onCreate} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Create one →</button>
          </div>
        ) : !activeNote ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-zinc-600">Select a note from the tree</p>
          </div>
        ) : editorMode === 'split' ? (
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <textarea
              value={displayContent}
              onChange={handleChange}
              placeholder="Start typing…"
              className="flex-1 min-w-0 bg-transparent text-zinc-200 text-sm resize-none outline-none px-5 py-4 placeholder-zinc-600 leading-relaxed select-text border-r border-brand-panel"
              spellCheck={false}
              ref={textareaRef}
            />
            <div
              className="flex-1 min-w-0 overflow-y-auto px-5 py-4 markdown-body select-text"
              dangerouslySetInnerHTML={{ __html: marked.parse(displayContent || '') as string }}
            />
          </div>
        ) : editorMode === 'raw' ? (
          <textarea
            value={displayContent}
            onChange={handleChange}
            placeholder="Start typing…"
            className="flex-1 w-full bg-transparent text-zinc-200 text-sm resize-none outline-none px-5 py-4 placeholder-zinc-600 leading-relaxed select-text"
            spellCheck={false}
            ref={textareaRef}
          />
        ) : (
          <div
            className="flex-1 overflow-y-auto px-5 py-4 markdown-body select-text"
            dangerouslySetInnerHTML={{ __html: marked.parse(displayContent || '') as string }}
          />
        )}
      </div>

    </div>
  )
}
