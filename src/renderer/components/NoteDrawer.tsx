import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Eye, Code, LayoutList, Plus, Search, ChevronRight, FolderOpen, FolderClosed, FileText, FolderPlus } from 'lucide-react'
import { marked } from 'marked'
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

const NOTE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4', '#14b8a6', '#f59e0b']
const FOLDER_COLORS = ['#6b7280', '#3b82f6', '#06b6d4', '#22c55e', '#14b8a6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308']
function noteColorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i)
  return NOTE_COLORS[Math.abs(hash) % NOTE_COLORS.length]
}

// ─── File tree panel ──────────────────────────────────────────────────────────

interface FileTreeProps {
  activeNoteId: string | null
  onActivate: (id: string) => void
  onCreate: () => void
}

function FileTree({ activeNoteId, onActivate, onCreate }: FileTreeProps): JSX.Element {
  const notes = useStore((s) => s.notes)
  const noteFolders = useStore((s) => s.settings.noteFolders ?? [])
  const noteFolderMap = useStore((s) => s.settings.noteFolderMap ?? {})
  const addNoteFolder = useStore((s) => s.addNoteFolder)
  const setNoteFolder = useStore((s) => s.setNoteFolder)
  const renameNoteFolder = useStore((s) => s.renameNoteFolder)
  const deleteNote = useStore((s) => s.deleteNote)
  const deleteNoteFolder = useStore((s) => s.deleteNoteFolder)
  const saveNote = useStore((s) => s.saveNote)

  const [query, setQuery] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [dragNoteId, setDragNoteId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ type: 'folder' | 'note'; id: string; x: number; y: number } | null>(null)
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null)
  const [renamingNoteName, setRenamingNoteName] = useState('')
  // null id = new folder, string id = edit existing
  const [folderPopover, setFolderPopover] = useState<{ id: string | null; name: string; color: string; x: number; y: number } | null>(null)
  const renamingNoteRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingNoteId) setTimeout(() => renamingNoteRef.current?.focus(), 0)
  }, [renamingNoteId])

  const startRenameNote = (id: string): void => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    setRenamingNoteId(id)
    setRenamingNoteName(noteTitle(note))
  }

  const commitRenameNote = async (): Promise<void> => {
    if (!renamingNoteId) return
    const note = notes.find(n => n.id === renamingNoteId)
    const newName = renamingNoteName.trim()
    if (note && newName) {
      const lines = note.content.split('\n')
      lines[0] = newName
      await saveNote(renamingNoteId, lines.join('\n'))
    }
    setRenamingNoteId(null)
  }

  const commitFolderPopover = async (): Promise<void> => {
    if (!folderPopover) return
    const name = folderPopover.name.trim()
    if (name) {
      if (folderPopover.id) {
        await renameNoteFolder(folderPopover.id, name, folderPopover.color)
      } else {
        await addNoteFolder(name, folderPopover.color)
      }
    }
    setFolderPopover(null)
  }

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'note', id: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 148)
    const y = Math.min(e.clientY, window.innerHeight - 72)
    setContextMenu({ type, id, x, y })
  }

  const openFolderPopover = (pos: { x: number; y: number }, folder?: { id: string; name: string; color?: string }): void => {
    setFolderPopover({
      id: folder?.id ?? null,
      name: folder?.name ?? '',
      color: folder?.color ?? '#6b7280',
      x: Math.min(pos.x, window.innerWidth - 220),
      y: Math.min(pos.y, window.innerHeight - 160),
    })
  }

  const sorted = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)
  const matchesQuery = (n: Note): boolean => !query || n.content.toLowerCase().includes(query.toLowerCase())
  const unfiledNotes = sorted.filter(n => !noteFolderMap[n.id] && matchesQuery(n))
  const sortedFolders = noteFolders.slice().sort((a, b) => a.name.localeCompare(b.name))

  const toggleFolder = (id: string): void => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full border-r border-brand-panel/60 bg-brand-surface/30">
      {/* Search + action icons */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-brand-panel/40 flex-shrink-0">
        <Search size={11} className="text-zinc-600 flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none min-w-0"
        />
        {query
          ? <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"><X size={10} /></button>
          : <>
              <button
                onClick={onCreate}
                title="New note"
                className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 p-0.5"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openFolderPopover({ x: r.left, y: r.bottom + 6 }) }}
                title="New folder"
                className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 p-0.5"
              >
                <FolderPlus size={13} />
              </button>
            </>
        }
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-3">
            <p className="text-[11px] text-zinc-600 text-center">No notes yet</p>
          </div>
        ) : (
          <>
            {unfiledNotes.map(note => {
              const nc = noteColorFromId(note.id)
              const isActive = note.id === activeNoteId
              if (renamingNoteId === note.id) return (
                <div key={note.id} className="px-3 py-1.5 border-l-2 border-transparent">
                  <input
                    ref={renamingNoteRef}
                    value={renamingNoteName}
                    onChange={(e) => setRenamingNoteName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { void commitRenameNote() } if (e.key === 'Escape') setRenamingNoteId(null) }}
                    onBlur={() => { void commitRenameNote() }}
                    className="w-full bg-brand-panel border border-brand-panel/60 rounded px-2 py-0.5 text-xs text-zinc-200 outline-none focus:border-brand-muted/50"
                  />
                </div>
              )
              return (
                <button
                  key={note.id}
                  draggable
                  onDragStart={() => setDragNoteId(note.id)}
                  onDragEnd={() => { setDragNoteId(null); setDragOverFolderId(null) }}
                  onClick={() => onActivate(note.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                  style={isActive ? { background: `linear-gradient(to right, ${nc}22, transparent)`, borderLeftColor: nc } : undefined}
                  className={cn('w-full text-left py-1.5 px-3 border-l-2 transition-colors', isActive ? '' : 'border-transparent hover:bg-brand-panel/20')}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={10} className="flex-shrink-0 text-zinc-600" />
                    <div className="text-xs font-medium text-zinc-200 truncate leading-snug">{noteTitle(note)}</div>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 pl-[18px]">{formatDate(note.updatedAt)}</div>
                </button>
              )
            })}

            {sortedFolders.map(folder => {
              const folderNotes = sorted.filter(n => noteFolderMap[n.id] === folder.id && matchesQuery(n))
              if (query && folderNotes.length === 0) return null
              const isCollapsed = collapsedFolders.has(folder.id)
              const fc = folder.color ?? '#6b7280'
              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id) }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Element | null)) setDragOverFolderId(null) }}
                  onDrop={(e) => { e.preventDefault(); if (dragNoteId) { void setNoteFolder(dragNoteId, folder.id); setDragNoteId(null); setDragOverFolderId(null) } }}
                  className={cn(dragOverFolderId === folder.id && 'bg-brand-panel/20')}
                >
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-brand-panel/20 transition-colors"
                  >
                    <ChevronRight size={10} className={cn('flex-shrink-0 transition-transform text-zinc-500', !isCollapsed && 'rotate-90')} />
                    {isCollapsed
                      ? <FolderClosed size={11} className="flex-shrink-0" style={{ color: fc }} />
                      : <FolderOpen size={11} className="flex-shrink-0" style={{ color: fc }} />}
                    <span className="text-xs font-semibold uppercase tracking-wider truncate flex-1" style={{ color: fc }}>
                      {folder.name}
                    </span>
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold leading-none"
                      style={{ background: `${fc}33`, color: fc }}
                    >
                      {folderNotes.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="ml-4 border-l border-brand-panel/40">
                      {folderNotes.map(note => {
                        const nc = noteColorFromId(note.id)
                        const isActive = note.id === activeNoteId
                        if (renamingNoteId === note.id) return (
                          <div key={note.id} className="px-3 py-1.5 border-l-2 border-transparent">
                            <input
                              ref={renamingNoteRef}
                              value={renamingNoteName}
                              onChange={(e) => setRenamingNoteName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { void commitRenameNote() } if (e.key === 'Escape') setRenamingNoteId(null) }}
                              onBlur={() => { void commitRenameNote() }}
                              className="w-full bg-brand-panel border border-brand-panel/60 rounded px-2 py-0.5 text-xs text-zinc-200 outline-none focus:border-brand-muted/50"
                            />
                          </div>
                        )
                        return (
                          <button
                            key={note.id}
                            draggable
                            onDragStart={() => setDragNoteId(note.id)}
                            onDragEnd={() => { setDragNoteId(null); setDragOverFolderId(null) }}
                            onClick={() => onActivate(note.id)}
                            onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                            style={isActive ? { background: `linear-gradient(to right, ${nc}22, transparent)`, borderLeftColor: nc } : undefined}
                            className={cn('w-full text-left py-1.5 px-3 border-l-2 transition-colors', isActive ? '' : 'border-transparent hover:bg-brand-panel/20')}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText size={10} className="flex-shrink-0 text-zinc-600" />
                              <div className="text-xs font-medium text-zinc-200 truncate leading-snug">{noteTitle(note)}</div>
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5 pl-[18px]">{formatDate(note.updatedAt)}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {query && sorted.filter(matchesQuery).length === 0 && (
              <div className="flex items-center justify-center py-6">
                <p className="text-[11px] text-zinc-600">No results</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }} />
          <div
            className="fixed z-[201] bg-brand-surface border border-brand-panel rounded shadow-xl py-1 min-w-[130px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'folder' ? (
              <>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors"
                  onClick={() => {
                    const f = noteFolders.find(f => f.id === contextMenu.id)
                    if (f) openFolderPopover({ x: contextMenu.x, y: contextMenu.y }, f)
                    setContextMenu(null)
                  }}
                >
                  Edit
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors"
                  onClick={() => { void deleteNoteFolder(contextMenu.id); setContextMenu(null) }}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors"
                  onClick={() => { startRenameNote(contextMenu.id); setContextMenu(null) }}
                >
                  Rename
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors"
                  onClick={() => { void deleteNote(contextMenu.id); setContextMenu(null) }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Folder popover — create or edit */}
      {folderPopover && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => { void commitFolderPopover() }} />
          <div
            className="fixed z-[201] bg-brand-surface border border-brand-panel/80 rounded-lg shadow-2xl p-3 flex flex-col gap-3"
            style={{ left: folderPopover.x, top: folderPopover.y, width: 208 }}
          >
            <input
              autoFocus
              value={folderPopover.name}
              onChange={(e) => setFolderPopover(p => p ? { ...p, name: e.target.value } : null)}
              onKeyDown={(e) => { if (e.key === 'Enter') { void commitFolderPopover() } if (e.key === 'Escape') setFolderPopover(null) }}
              placeholder="Folder name"
              className="bg-brand-panel border border-brand-panel/60 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-muted/40 w-full"
            />
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setFolderPopover(p => p ? { ...p, color } : null) }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 transition-transform hover:scale-110',
                    folderPopover.color === color ? 'border-zinc-200 scale-110' : 'border-transparent'
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setFolderPopover(null)}
                className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); void commitFolderPopover() }}
                className="px-2.5 py-1 text-[11px] rounded transition-colors"
                style={{ background: `${folderPopover.color}22`, color: folderPopover.color, border: `1px solid ${folderPopover.color}44` }}
              >
                {folderPopover.id ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export interface NoteDrawerProps {
  open: boolean
  onClose: () => void
  activeNoteId: string | null
  onActivate: (id: string) => void
  onCreate: () => void
  expanded: boolean
  onToggleExpand: () => void
}

export function NoteDrawer({
  open, onClose, activeNoteId, onActivate, onCreate, expanded, onToggleExpand
}: NoteDrawerProps): JSX.Element | null {
  const notes = useStore((s) => s.notes)
  const saveNote = useStore((s) => s.saveNote)

  const activeNote = notes.find(n => n.id === activeNoteId)
    ?? notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
    ?? null

  const [showTree, setShowTree] = useState(false)
  const [editorMode, setEditorMode] = useState<'raw' | 'preview'>('raw')
  const [displayContent, setDisplayContent] = useState(activeNote?.content ?? '')
  const localContentRef = useRef(activeNote?.content ?? '')
  const prevIdRef = useRef<string | null>(activeNote?.id ?? null)
  const effectiveIdRef = useRef<string | null>(activeNote?.id ?? null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [open])

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

  const handleActivate = (id: string): void => {
    onActivate(id)
  }

  const handleCreate = (): void => {
    onCreate()
  }

  if (!open && !expanded) return null

  const drawerContent = (
    <div className="flex h-full w-full bg-brand-bg">
      {/* File tree — slides in on the left */}
      {showTree && (
        <div className="w-[240px] flex-shrink-0 flex flex-col min-h-0">
          <FileTree
            activeNoteId={activeNoteId}
            onActivate={handleActivate}
            onCreate={handleCreate}
          />
        </div>
      )}

      {/* Editor */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
        {/* Header */}
        <div className="flex items-center px-3 h-10 border-b border-brand-panel flex-shrink-0 gap-2">
          <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">
            {activeNote ? noteTitle(activeNote) : 'Notes'}
          </span>
          {activeNote && (
            <button
              onClick={() => setEditorMode(m => m === 'raw' ? 'preview' : 'raw')}
              className="text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0"
              title={editorMode === 'raw' ? 'Preview' : 'Raw'}
            >
              {editorMode === 'raw' ? <Eye size={15} /> : <Code size={15} />}
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0"
            title="Close notes"
          >
            <X size={15} />
          </button>
        </div>

        {/* Editor body */}
        {notes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-zinc-600">No notes yet</p>
            <button onClick={handleCreate} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Create one →</button>
          </div>
        ) : !activeNote ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-zinc-600">Select a note from the tree</p>
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

        {/* Floating tree toggle */}
        <button
          onClick={() => setShowTree(v => !v)}
          title={showTree ? 'Hide file tree' : 'Browse notes'}
          className={cn(
            'absolute bottom-4 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border transition-colors',
            showTree
              ? 'bg-brand-panel border-brand-muted/30 text-brand-muted hover:bg-brand-panel/80'
              : 'bg-brand-panel border-brand-panel/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
          )}
        >
          <LayoutList size={15} />
        </button>
      </div>
    </div>
  )

  if (expanded) return (
    <div className="h-full w-full">
      {drawerContent}
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[91] border-l border-brand-panel shadow-2xl" style={{ width: showTree ? 760 : 480 }}>
        {drawerContent}
      </div>
    </>
  )
}
