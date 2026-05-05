import { Settings } from 'lucide-react'
import { IPC } from '@shared/ipc-channels'
import { ipc } from '../../../lib/ipc'
import { cn } from '../../../lib/utils'

export function SettingsDialog({ lg }: { lg?: boolean } = {}): JSX.Element {
  return (
    <button
      onClick={() => ipc.invoke(IPC.WINDOW_OPEN_SETTINGS)}
      className={cn(
        'flex items-center justify-center transition-colors',
        lg
          ? 'w-12 h-12 border-l-2 border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/20 flex-shrink-0'
          : 'w-8 h-8 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300'
      )}
      title="Settings"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <Settings size={lg ? 20 : 14} />
    </button>
  )
}
