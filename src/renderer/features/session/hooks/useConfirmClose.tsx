import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../../store/root.store'

export function useConfirmClose(): {
  requestClose: (onConfirm: () => void) => void
  modal: JSX.Element | null
} {
  const confirmCloseSession = useStore((s) => s.settings.confirmCloseSession)
  const updateSettings = useStore((s) => s.updateSettings)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [dontAsk, setDontAsk] = useState(false)

  const requestClose = (onConfirm: () => void): void => {
    if (confirmCloseSession === false) {
      onConfirm()
      return
    }
    setDontAsk(false)
    setPending(() => onConfirm)
  }

  const handleConfirm = async (): Promise<void> => {
    if (dontAsk) await updateSettings({ confirmCloseSession: false })
    pending?.()
    setPending(null)
  }

  const handleCancel = (): void => setPending(null)

  const modal = pending
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel() }}
        >
          <div className="bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl p-4 w-64 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Close session?</p>
              <p className="text-xs text-zinc-500 mt-1">The session will be terminated.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontAsk}
                onChange={(e) => setDontAsk(e.target.checked)}
                className="w-3.5 h-3.5 accent-brand-green"
              />
              <span className="text-xs text-zinc-500">Don't ask again</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-brand-panel"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null

  return { requestClose, modal }
}
