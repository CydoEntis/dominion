import { useState, useEffect, useCallback } from 'react'
import { Eye } from 'lucide-react'
import { NoteDrawer } from '../../../components/NoteDrawer'
import { useStore } from '../../../store/root.store'

interface Props {
  tabId: string
  leafId: string
  initialNoteId?: string
}

export function NotesPane({ tabId, leafId, initialNoteId }: Props): JSX.Element | null {
  const removeLayoutLeaf = useStore((s) => s.removeLayoutLeaf)
  const openMarkdownPreviewPane = useStore((s) => s.openMarkdownPreviewPane)
  const addNote = useStore((s) => s.addNote)
  const saveNote = useStore((s) => s.saveNote)
  const notes = useStore((s) => s.notes)

  const [activeNoteId, setActiveNoteId] = useState<string | null>(initialNoteId ?? null)

  useEffect(() => {
    if (!initialNoteId && notes.length > 0) {
      const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
      setActiveNoteId(sorted[0].id)
    }
  // only initialize on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Broadcast which note is active so the sidebar can highlight it
  useEffect(() => {
    if (activeNoteId) {
      document.dispatchEvent(new CustomEvent('acc:note-active-changed', { detail: { noteId: activeNoteId, tabId } }))
    }
  }, [activeNoteId, tabId])

  // Receive activation from sidebar — only respond if event targets this specific leaf
  useEffect(() => {
    const handler = (e: Event): void => {
      const { noteId, leafId: targetLeafId } = (e as CustomEvent<{ noteId: string; leafId?: string }>).detail
      if (!targetLeafId || targetLeafId === leafId) setActiveNoteId(noteId)
    }
    document.addEventListener('acc:activate-note', handler)
    return () => document.removeEventListener('acc:activate-note', handler)
  }, [leafId])

  const createNote = useCallback((): string => {
    const { notes: current } = useStore.getState()
    const sorted = [...current].sort((a, b) => b.updatedAt - a.updatedAt)
    if (sorted.length > 0 && sorted[0].content.trim() === '') {
      setActiveNoteId(sorted[0].id)
      return sorted[0].id
    }
    const id = crypto.randomUUID()
    addNote(id)
    saveNote(id, '')
    setActiveNoteId(id)
    return id
  }, [addNote, saveNote])

  useEffect(() => {
    const handler = (): void => { createNote() }
    document.addEventListener('acc:new-note', handler)
    return () => document.removeEventListener('acc:new-note', handler)
  }, [createNote])

  const handleClose = useCallback((): void => {
    removeLayoutLeaf(tabId, leafId)
  }, [removeLayoutLeaf, tabId, leafId])

  return (
    <NoteDrawer
      onClose={handleClose}
      activeNoteId={activeNoteId}
      onActivate={setActiveNoteId}
      onCreate={createNote}
      onOpenPreview={activeNoteId ? () => openMarkdownPreviewPane(activeNoteId) : undefined}
    />
  )
}
