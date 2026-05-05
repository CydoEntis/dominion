import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store/root.store'
import type { Note } from '@shared/ipc-types'

function noteTitle(note: Note): string {
  const first = note.content.split('\n').find(l => l.trim())
  return first?.trim().slice(0, 50) || 'Untitled'
}

interface Props {
  open: boolean
  onClose: () => void
  activeNoteId: string | null
  onCreate: () => void
}

export function NoteDrawer({ open, onClose, activeNoteId, onCreate }: Props): JSX.Element | null {
  const notes = useStore((s) => s.notes)
  const saveNote = useStore((s) => s.saveNote)

  const activeNote = notes.find(n => n.id === activeNoteId) ?? notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
  const effectiveId = activeNote?.id ?? null

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [displayContent, setDisplayContent] = useState(activeNote?.content ?? '')
  const localContentRef = useRef(activeNote?.content ?? '')
  const prevIdRef = useRef<string | null>(effectiveId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [open])

  const flushSave = useCallback((id: string, content: string): void => {
    saveNote(id, content)
  }, [saveNote])

  useEffect(() => {
    if (prevIdRef.current !== effectiveId) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (prevIdRef.current) flushSave(prevIdRef.current, localContentRef.current)
      prevIdRef.current = effectiveId
    }
    const content = activeNote?.content ?? ''
    localContentRef.current = content
    setDisplayContent(content)
  }, [effectiveId, flushSave])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    localContentRef.current = value
    setDisplayContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { if (effectiveId) flushSave(effectiveId, value) }, 400)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[91] w-[420px] max-w-[50vw] bg-brand-bg border-l border-brand-panel flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 h-10 border-b border-brand-panel flex-shrink-0">
          <span className="text-xs text-zinc-400 truncate flex-1">
            {activeNote ? noteTitle(activeNote) : 'Notes'}
          </span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors ml-2 flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-zinc-600">No notes yet</p>
            <button onClick={onCreate} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Create one →</button>
          </div>
        ) : (
          <textarea
            value={displayContent}
            onChange={handleChange}
            placeholder="Start typing..."
            className="flex-1 w-full bg-transparent text-zinc-200 text-sm resize-none outline-none px-5 py-4 placeholder-zinc-600 leading-relaxed"
            spellCheck={false}
            ref={textareaRef}
          />
        )}
      </div>
    </>
  )
}
