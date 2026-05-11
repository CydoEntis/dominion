import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/utils'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import type { Note, NoteFolder } from '@shared/ipc-types'

const NOTE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#14b8a6', '#f59e0b']

interface EditNoteModalProps {
  note: Note
  folders: NoteFolder[]
  currentFolderId: string | null
  currentColor: string | null
  onSave: (name: string, color: string | null, folderId: string | null) => void
  onDismiss: () => void
}

export function EditNoteModal({ note, folders, currentFolderId, currentColor, onSave, onDismiss }: EditNoteModalProps): JSX.Element {
  const firstLine = note.content.split('\n').find(l => l.trim())?.trim().slice(0, 50) || 'Untitled'
  const [name, setName] = useState(firstLine)
  const [color, setColor] = useState<string | null>(currentColor)
  const [folderId, setFolderId] = useState<string | null>(currentFolderId)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  const validate = (v: string): string | null => {
    if (!v.trim()) return 'Name cannot be blank'
    if (v.trim().length > 50) return 'Max 50 characters'
    return null
  }

  const handleSave = (): void => {
    const trimmed = name.trim()
    const err = validate(trimmed)
    if (err) { setError(err); return }
    onSave(trimmed, color, folderId)
  }

  const isCustomColor = color !== null && !(NOTE_COLORS as readonly string[]).includes(color)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">Edit Note</span>
          <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Name</Label>
            <span className={cn('text-xs', name.trim().length > 50 ? 'text-red-400' : 'text-zinc-600')}>
              {name.trim().length}/50
            </span>
          </div>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(validate(e.target.value)) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            className={cn(error ? 'border-red-500/70 focus-visible:ring-0 focus:border-red-400' : '')}
          />
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-zinc-500">Color</Label>
          <div className="flex gap-2 flex-wrap">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0',
                  color === c && 'ring-2 ring-white ring-offset-2 ring-offset-brand-surface scale-110'
                )}
              />
            ))}
            <label
              className="relative w-7 h-7 rounded-full cursor-pointer flex-shrink-0 border-2 border-dashed border-zinc-600 hover:border-zinc-400 transition-colors flex items-center justify-center overflow-hidden"
              title="Custom color"
            >
              <span className="absolute inset-0 rounded-full" style={{ backgroundColor: isCustomColor ? (color ?? 'transparent') : 'transparent' }} />
              <input
                type="color"
                value={color ?? NOTE_COLORS[0]}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              {!isCustomColor && <span className="text-zinc-600 text-[10px]">+</span>}
            </label>
          </div>
        </div>

        {folders.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-500">Folder</Label>
            <select
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="bg-brand-panel border border-brand-panel/60 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-brand-muted/40 w-full"
            >
              <option value="">None</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!!error || !name.trim()}
            className="px-4 py-1.5 text-xs font-medium rounded bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
