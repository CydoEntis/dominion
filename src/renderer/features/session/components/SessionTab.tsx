import { X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { SessionMeta } from '@shared/ipc-types'
import { killSession } from '../session.service'
import { useStore } from '../../../store/root.store'

interface Props {
  meta: SessionMeta
  isActive: boolean
  onActivate: () => void
}

export function SessionTab({ meta, isActive, onActivate }: Props): JSX.Element {
  const removeTab = useStore((s) => s.removeTab)

  const handleClose = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await killSession(meta.sessionId)
    removeTab(meta.sessionId)
  }

  const isExited = meta.status !== 'running'

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={onActivate}
      className={cn(
        'flex items-center gap-2 h-full px-4 text-sm font-medium cursor-pointer border-b-2 transition-colors select-none flex-shrink-0 min-w-[140px] max-w-[220px]',
        isActive
          ? 'border-brand-green text-zinc-100 bg-brand-green/10'
          : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/40',
        isExited && 'opacity-50'
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {isExited ? (
        <span className="w-2 h-2 rounded-full bg-zinc-500 flex-shrink-0" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-brand-green flex-shrink-0 animate-pulse" />
      )}

      <span className="flex-1 truncate">{meta.name}</span>

      <button
        onClick={handleClose}
        title="Close session"
        className="flex-shrink-0 p-0.5 rounded hover:bg-white/15 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
