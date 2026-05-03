import { useState, useRef, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/utils'
import type { SessionMeta } from '@shared/ipc-types'
import { killSession, patchSession } from '../session.service'
import { useStore } from '../../../store/root.store'
import { useConfirmClose } from '../hooks/useConfirmClose'

const TAB_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#06b6d4',
  '#71717a',
]

const DEFAULT_COLOR = '#22c55e'
const MAX_NAME_LENGTH = 32

interface EditModalProps {
  meta: SessionMeta
  onSave: (name: string, color: string) => void
  onDismiss: () => void
}

function EditModal({ meta, onSave, onDismiss }: EditModalProps): JSX.Element {
  const [name, setName] = useState(meta.name)
  const [color, setColor] = useState(meta.color ?? DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  const validate = (value: string): string | null => {
    if (!value.trim()) return 'Name cannot be blank'
    if (value.trim().length > MAX_NAME_LENGTH) return `Max ${MAX_NAME_LENGTH} characters`
    return null
  }

  const handleNameChange = (value: string): void => {
    setName(value)
    setError(validate(value))
  }

  const handleSave = (): void => {
    const trimmed = name.trim()
    const err = validate(trimmed)
    if (err) { setError(err); return }
    onSave(trimmed, color)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">Edit Session</span>
          <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-500">Name</label>
            <span className={cn('text-xs', name.trim().length > MAX_NAME_LENGTH ? 'text-red-400' : 'text-zinc-600')}>
              {name.trim().length}/{MAX_NAME_LENGTH}
            </span>
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            className={cn(
              'bg-brand-panel border text-zinc-100 text-sm px-3 py-1.5 rounded outline-none transition-colors',
              error ? 'border-red-500/70 focus:border-red-400' : 'border-brand-panel/80 focus:border-zinc-500'
            )}
          />
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-500">Color</label>
          <div className="flex gap-2 flex-wrap">
            {TAB_COLORS.map((c) => (
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
          </div>
        </div>

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
            className="px-4 py-1.5 text-xs font-medium rounded bg-brand-green text-black hover:bg-brand-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface Props {
  meta: SessionMeta
  isActive: boolean
  onActivate: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export function SessionTab({ meta, isActive, onActivate, onContextMenu }: Props): JSX.Element {
  const removeTab = useStore((s) => s.removeTab)
  const upsertSession = useStore((s) => s.upsertSession)
  const [editOpen, setEditOpen] = useState(false)
  const { requestClose, modal: closeModal } = useConfirmClose()

  const color = meta.color ?? DEFAULT_COLOR
  const isExited = meta.status !== 'running'
  const agentStatus = meta.agentStatus ?? 'idle'

  const handleClose = (e: React.MouseEvent): void => {
    e.stopPropagation()
    requestClose(async () => {
      await killSession(meta.sessionId)
      removeTab(meta.sessionId)
    })
  }

  const handleDoubleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setEditOpen(true)
  }

  const handleSave = async (name: string, color: string): Promise<void> => {
    setEditOpen(false)
    const updated = await patchSession({ sessionId: meta.sessionId, name, color })
    upsertSession(updated)
    toast.success('Session updated')
  }

  return (
    <>
      <div
        role="tab"
        aria-selected={isActive}
        onClick={onActivate}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e) }}
        className={cn(
          'flex items-center gap-1.5 h-full px-4 text-sm font-medium cursor-pointer border-b-2 transition-colors select-none flex-shrink-0 min-w-0 w-[160px]',
          isActive
            ? 'text-zinc-100 bg-brand-panel/20'
            : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/40',
          isExited && 'opacity-50'
        )}
        style={{
          borderBottomColor: isActive ? color : 'transparent',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties}
      >
        {!isExited && agentStatus === 'running' ? (
          <Loader2 size={12} className="flex-shrink-0 animate-spin" style={{ color }} />
        ) : !isExited && agentStatus === 'waiting-input' ? (
          <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse bg-amber-400" />
        ) : (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: isExited ? '#71717a' : color }}
          />
        )}

        <span className="flex-1 truncate min-w-0 text-sm">{meta.name}</span>

        <button
          onClick={handleClose}
          title="Close session"
          className="flex-shrink-0 p-0.5 rounded hover:bg-white/15 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {editOpen && (
        <EditModal
          meta={meta}
          onSave={handleSave}
          onDismiss={() => setEditOpen(false)}
        />
      )}
      {closeModal}
    </>
  )
}
