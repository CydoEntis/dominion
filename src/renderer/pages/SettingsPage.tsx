import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Toaster } from 'sonner'
import { IPC } from '@shared/ipc-channels'
import { ipc } from '../lib/ipc'
import { useStore } from '../store/root.store'
import { SettingsForm } from '../features/settings/components/SettingsForm'

export function SettingsPage(): JSX.Element {
  const loadSettings = useStore((s) => s.loadSettings)
  const settingsLoaded = useStore((s) => s.settingsLoaded)

  useEffect(() => { loadSettings() }, [loadSettings])

  const close = (): void => ipc.send(IPC.WINDOW_CONTROL, 'close')

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-zinc-100 overflow-hidden dark">
      <div
        className="flex items-center px-4 h-10 border-b border-brand-panel flex-shrink-0 bg-brand-surface"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-sm font-medium text-zinc-300 flex-1 select-none">Settings</span>
        <button
          onClick={close}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <X size={14} />
        </button>
      </div>

      {settingsLoaded ? (
        <SettingsForm onClose={close} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-600">Loading…</p>
        </div>
      )}

      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  )
}
