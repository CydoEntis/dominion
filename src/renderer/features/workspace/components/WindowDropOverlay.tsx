import { useWindowDrop } from '../../session/hooks/useWindowDrop'

export function WindowDropOverlay(): JSX.Element | null {
  const { isDropTarget, dropSessionMeta } = useWindowDrop()

  if (!isDropTarget) return null

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none border-2 border-brand-accent/60">
      <div className="absolute inset-0 bg-brand-accent/5" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-brand-surface border border-brand-accent/40 rounded-lg px-5 py-3 shadow-xl">
          <p className="text-sm text-zinc-200">
            {dropSessionMeta
              ? `Drop to move "${dropSessionMeta.name}" here`
              : 'Drop to move session here'}
          </p>
        </div>
      </div>
    </div>
  )
}
