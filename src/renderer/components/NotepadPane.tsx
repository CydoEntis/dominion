import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/root.store'
import { cn } from '../lib/utils'
import type { Note } from '@shared/ipc-types'

function noteTitle(note: Note): string {
  const first = note.content.split('\n').find(l => l.trim())
  return first?.trim().slice(0, 50) || 'Untitled'
}

function notePreview(note: Note): string {
  const lines = note.content.split('\n').filter(l => l.trim())
  return lines[1]?.trim().slice(0, 60) || ''
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface Props {
  activeNoteId: string | null
  onActivate: (id: string) => void
  onCreate: () => void
}

export function NotepadPane({ activeNoteId, onActivate, onCreate }: Props): JSX.Element {
  const notes = useStore((s) => s.notes)
  const deleteNote = useStore((s) => s.deleteNote)

  const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      <div className="flex items-center justify-between px-3 h-10 border-b border-brand-panel flex-shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Notes</span>
        <button
          onClick={onCreate}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/60 transition-colors"
          title="New note (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-xs text-zinc-600 text-center">No notes yet</p>
            <button onClick={onCreate} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Create one →
            </button>
          </div>
        )}
        {sorted.map(note => (
          <button
            key={note.id}
            onClick={() => onActivate(note.id)}
            className={cn(
              'w-full text-left px-3 py-2.5 border-b border-brand-panel/30 transition-colors group relative',
              note.id === activeNoteId ? 'bg-brand-panel/60' : 'hover:bg-brand-panel/30'
            )}
          >
            <div className="flex items-start justify-between gap-1 pr-5">
              <span className="text-xs text-zinc-200 truncate leading-snug flex-1">{noteTitle(note)}</span>
              <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-0.5">{formatDate(note.updatedAt)}</span>
            </div>
            {notePreview(note) && (
              <p className="text-[10px] text-zinc-600 truncate mt-0.5 pr-5">{notePreview(note)}</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 transition-all"
              title="Delete note"
            >
              <Trash2 size={10} />
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
