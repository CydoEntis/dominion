import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Search, X, Pencil, FolderPlus, ChevronRight, FolderOpen, FolderClosed, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/root.store'
import { cn } from '../lib/utils'
import type { Note } from '@shared/ipc-types'

const FOLDER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
]

const NOTE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#14b8a6', '#f59e0b']
function noteColorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length]
}

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

interface CtxMenu { x: number; y: number }

type FolderModalState =
  | { mode: 'create' }
  | { mode: 'edit'; folderId: string; name: string; color?: string }

function useOutsideClick(ref: React.RefObject<HTMLElement>, cb: () => void): void {
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      cb()
    }
    document.addEventListener('mousedown', handler, true)
    document.addEventListener('contextmenu', handler, true)
    return () => {
      document.removeEventListener('mousedown', handler, true)
      document.removeEventListener('contextmenu', handler, true)
    }
  }, [cb])
}

// ─── New / Edit Folder Modal ──────────────────────────────────────────────────

function FolderModal({ initial, onConfirm, onCancel }: {
  initial?: { name: string; color?: string }
  onConfirm: (name: string, color: string) => void
  onCancel: () => void
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? FOLDER_COLORS[0])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0) }, [])

  const submit = (): void => {
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed, color)
  }

  const isCustom = !FOLDER_COLORS.includes(color)

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl p-4 w-60">
        <p className="text-xs text-zinc-300 font-medium mb-3">
          {initial ? 'Edit Folder' : 'New Folder'}
        </p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
          placeholder="Folder name"
          className="w-full bg-brand-panel border border-brand-panel/60 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-muted/50 mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={cn(
                'w-5 h-5 rounded-full transition-all hover:scale-110',
                color === c ? 'ring-2 ring-offset-2 ring-offset-brand-surface ring-white/50 scale-110' : 'opacity-60'
              )}
            />
          ))}
          <label
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110',
              isCustom
                ? 'ring-2 ring-offset-2 ring-offset-brand-surface ring-white/50 scale-110'
                : 'bg-brand-panel border border-zinc-600 opacity-60 hover:opacity-100'
            )}
            style={isCustom ? { backgroundColor: color } : undefined}
            title="Custom color"
          >
            {!isCustom && <Plus size={8} className="text-zinc-500" />}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-3 py-1 text-xs bg-brand-panel text-zinc-200 rounded hover:bg-brand-panel/70 transition-colors disabled:opacity-40"
          >
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Pane context menu (right-click on blank area) ────────────────────────────

function PaneCtxMenu({ x, y, onCreateFolder, onDismiss }: CtxMenu & { onCreateFolder: () => void; onDismiss: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, onDismiss)
  const ax = Math.min(x, window.innerWidth - 168)
  const ay = Math.min(y, window.innerHeight - 60)
  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: ay, left: ax, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-40"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={() => { onCreateFolder(); onDismiss() }}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
      >
        <FolderPlus size={11} className="flex-shrink-0" /> New folder
      </button>
    </div>,
    document.body
  )
}

// ─── Note context menu ────────────────────────────────────────────────────────

function NoteCtxMenu({ x, y, note, onDismiss }: CtxMenu & { note: Note; onDismiss: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const noteFolders = useStore((s) => s.settings.noteFolders ?? [])
  const noteFolderMap = useStore((s) => s.settings.noteFolderMap ?? {})
  const setNoteFolder = useStore((s) => s.setNoteFolder)
  const deleteNote = useStore((s) => s.deleteNote)

  useOutsideClick(ref, onDismiss)

  const currentFolderId = noteFolderMap[note.id] ?? null
  const ax = Math.min(x, window.innerWidth - 180)
  const ay = Math.min(y, window.innerHeight - 200)
  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: ay, left: ax, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-44"
      onContextMenu={(e) => e.preventDefault()}
    >
      {noteFolders.length > 0 && (
        <>
          <p className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wider">Move to folder</p>
          {currentFolderId && (
            <button
              onClick={dismiss(() => setNoteFolder(note.id, null))}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
            >
              <X size={10} className="flex-shrink-0" /> No folder
            </button>
          )}
          {noteFolders.map((f) => (
            <button
              key={f.id}
              onClick={dismiss(() => setNoteFolder(note.id, f.id))}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-brand-panel transition-colors text-left',
                currentFolderId === f.id ? 'text-zinc-200' : 'text-zinc-400 hover:text-zinc-100'
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color ?? '#6b7280' }} />
              {f.name}
            </button>
          ))}
          <div className="h-px bg-brand-panel my-1" />
        </>
      )}
      <button
        onClick={dismiss(() => deleteNote(note.id))}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors text-left"
      >
        <Trash2 size={10} className="flex-shrink-0" /> Delete note
      </button>
    </div>,
    document.body
  )
}

// ─── Folder header context menu ───────────────────────────────────────────────

function FolderCtxMenu({ x, y, folderId, onDismiss, onEdit }: CtxMenu & { folderId: string; onDismiss: () => void; onEdit: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const deleteNoteFolder = useStore((s) => s.deleteNoteFolder)

  useOutsideClick(ref, onDismiss)

  const ax = Math.min(x, window.innerWidth - 160)
  const ay = Math.min(y, window.innerHeight - 100)
  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: ay, left: ax, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-36"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={dismiss(onEdit)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left"
      >
        <Pencil size={10} className="flex-shrink-0" /> Edit
      </button>
      <button
        onClick={dismiss(() => deleteNoteFolder(folderId))}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors text-left"
      >
        <X size={10} className="flex-shrink-0" /> Delete folder
      </button>
    </div>,
    document.body
  )
}

// ─── Note row ─────────────────────────────────────────────────────────────────

function NoteRow({ note, isActive, onActivate, onCtxMenu, indent = false }: {
  note: Note
  isActive: boolean
  onActivate: () => void
  onCtxMenu: (e: React.MouseEvent) => void
  indent?: boolean
}): JSX.Element {
  const nc = noteColorFromId(note.id)
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('note-id', note.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onActivate}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e) }}
      style={isActive ? { background: `linear-gradient(to right, ${nc}28, transparent)`, borderLeftColor: nc } : undefined}
      className={cn(
        'w-full text-left py-2.5 border-b border-brand-panel/30 transition-colors',
        indent ? 'pl-7 pr-3' : 'px-3',
        isActive ? '' : 'hover:bg-brand-panel/30'
      )}
    >
      <div className="flex items-start justify-between gap-1 pr-5">
        <span className="text-xs text-zinc-200 truncate leading-snug flex-1">{noteTitle(note)}</span>
        <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-0.5">{formatDate(note.updatedAt)}</span>
      </div>
      {notePreview(note) && (
        <p className="text-[10px] text-zinc-600 truncate mt-0.5 pr-5">{notePreview(note)}</p>
      )}
    </button>
  )
}

// ─── Main pane ────────────────────────────────────────────────────────────────

export function NotepadPane({ activeNoteId, onActivate, onCreate }: Props): JSX.Element {
  const notes = useStore((s) => s.notes)
  const noteFolders = useStore((s) => s.settings.noteFolders ?? [])
  const noteFolderMap = useStore((s) => s.settings.noteFolderMap ?? {})
  const addNoteFolder = useStore((s) => s.addNoteFolder)
  const renameNoteFolder = useStore((s) => s.renameNoteFolder)
  const setNoteFolder = useStore((s) => s.setNoteFolder)

  const [query, setQuery] = useState('')
  const [noteCtxMenu, setNoteCtxMenu] = useState<{ x: number; y: number; note: Note } | null>(null)
  const [folderCtxMenu, setFolderCtxMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)
  const [folderModal, setFolderModal] = useState<FolderModalState | null>(null)
  const [paneCtxMenu, setPaneCtxMenu] = useState<CtxMenu | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)

  const matchesQuery = (n: Note): boolean =>
    !query || n.content.toLowerCase().includes(query.toLowerCase())

  const unfiledNotes = sorted.filter(n => !noteFolderMap[n.id] && matchesQuery(n))
  const notesForFolder = (folderId: string): Note[] =>
    sorted.filter(n => noteFolderMap[n.id] === folderId && matchesQuery(n))

  const toggleCollapse = (folderId: string): void => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleFolderModalConfirm = async (name: string, color: string): Promise<void> => {
    if (!folderModal) return
    if (folderModal.mode === 'create') {
      await addNoteFolder(name, color)
    } else {
      await renameNoteFolder(folderModal.folderId, name, color)
    }
    setFolderModal(null)
  }

  const openCreateFolder = (): void => setFolderModal({ mode: 'create' })

  const totalNotes = sorted.filter(matchesQuery).length
  const hasAnyNotes = notes.length > 0

  return (
    <div
      className="flex flex-col h-full bg-brand-bg"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-ctx-stop]')) return
        e.preventDefault()
        setPaneCtxMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-brand-panel flex-shrink-0" data-ctx-stop>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Notes</span>
        <button
          onClick={onCreate}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/60 transition-colors"
          title="New note (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-brand-panel/40 flex-shrink-0" data-ctx-stop>
        <Search size={11} className="text-zinc-600 flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X size={10} />
          </button>
        )}
        {noteFolders.length > 0 && (
          <>
            <div className="w-px h-3 bg-brand-panel/60 flex-shrink-0" />
            <button
              onClick={() => setCollapsedFolders(new Set())}
              title="Expand all folders"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ChevronsUpDown size={11} />
            </button>
            <button
              onClick={() => setCollapsedFolders(new Set(noteFolders.map(f => f.id)))}
              title="Collapse all folders"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ChevronsDownUp size={11} />
            </button>
          </>
        )}
      </div>

      {/* Note tree */}
      <div className="flex-1 overflow-y-auto">
        {!hasAnyNotes && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-xs text-zinc-600 text-center">No notes yet</p>
            <button onClick={onCreate} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Create one →
            </button>
          </div>
        )}

        {/* Unfiled notes */}
        {unfiledNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            isActive={note.id === activeNoteId}
            onActivate={() => onActivate(note.id)}
            onCtxMenu={(e) => setNoteCtxMenu({ x: e.clientX, y: e.clientY, note })}
          />
        ))}

        {/* Folder sections */}
        {noteFolders.map((folder) => {
          const folderNotes = notesForFolder(folder.id)
          if (query && folderNotes.length === 0) return null
          const isCollapsed = collapsedFolders.has(folder.id)
          const isDragTarget = dragOverFolder === folder.id

          return (
            <div key={folder.id}>
              {/* Folder header */}
              <div
                data-ctx-stop
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border-b border-brand-panel/60 cursor-pointer group select-none transition-all',
                  isDragTarget && 'brightness-125'
                )}
                style={{ background: `linear-gradient(to right, ${folder.color ?? '#6b7280'}2e, transparent)` }}
                onClick={() => toggleCollapse(folder.id)}
                onDoubleClick={() => setFolderModal({ mode: 'edit', folderId: folder.id, name: folder.name, color: folder.color })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setFolderCtxMenu({ x: e.clientX, y: e.clientY, folderId: folder.id })
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id) }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const noteId = e.dataTransfer.getData('note-id')
                  if (noteId) setNoteFolder(noteId, folder.id)
                  setDragOverFolder(null)
                }}
              >
                {isCollapsed
                  ? <FolderClosed size={13} className="flex-shrink-0" style={{ color: folder.color ?? '#6b7280' }} />
                  : <FolderOpen size={13} className="flex-shrink-0" style={{ color: folder.color ?? '#6b7280' }} />}
                <span className="text-xs font-semibold text-zinc-200 truncate flex-1">{folder.name}</span>
                <span className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">{folderNotes.length}</span>
              </div>

              {/* Notes in folder */}
              {!isCollapsed && (
                <div className="border-l border-brand-panel/40 ml-4">
                  {folderNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      isActive={note.id === activeNoteId}
                      onActivate={() => onActivate(note.id)}
                      onCtxMenu={(e) => setNoteCtxMenu({ x: e.clientX, y: e.clientY, note })}
                      indent
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Empty search state */}
        {query && totalNotes === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-zinc-600">No results</p>
          </div>
        )}
      </div>

      {/* Add folder — matches app button style */}
      <div className="flex-shrink-0 border-t border-brand-panel/60 p-2" data-ctx-stop>
        <button
          onClick={openCreateFolder}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-muted transition-colors rounded"
        >
          <FolderPlus size={13} /> Add folder
        </button>
      </div>

      {folderModal && (
        <FolderModal
          initial={folderModal.mode === 'edit' ? { name: folderModal.name, color: folderModal.color } : undefined}
          onConfirm={handleFolderModalConfirm}
          onCancel={() => setFolderModal(null)}
        />
      )}
      {paneCtxMenu && (
        <PaneCtxMenu
          x={paneCtxMenu.x}
          y={paneCtxMenu.y}
          onCreateFolder={openCreateFolder}
          onDismiss={() => setPaneCtxMenu(null)}
        />
      )}
      {noteCtxMenu && (
        <NoteCtxMenu
          x={noteCtxMenu.x}
          y={noteCtxMenu.y}
          note={noteCtxMenu.note}
          onDismiss={() => setNoteCtxMenu(null)}
        />
      )}
      {folderCtxMenu && (
        <FolderCtxMenu
          x={folderCtxMenu.x}
          y={folderCtxMenu.y}
          folderId={folderCtxMenu.folderId}
          onDismiss={() => setFolderCtxMenu(null)}
          onEdit={() => {
            const folder = noteFolders.find(f => f.id === folderCtxMenu.folderId)
            if (folder) setFolderModal({ mode: 'edit', folderId: folder.id, name: folder.name, color: folder.color })
          }}
        />
      )}
    </div>
  )
}
