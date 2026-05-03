import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { Columns2, Rows2, ExternalLink, PanelLeftOpen, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface Props {
  x: number
  y: number
  isMainWindow: boolean
  onDismiss: () => void
  onSplitH: () => void
  onSplitV: () => void
  onDetach: () => void
  onReattach: () => void
  onClose: () => void
}

function MenuItem({
  icon,
  label,
  onClick,
  className
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left',
        className
      )}
    >
      <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

export function PaneContextMenu({ x, y, isMainWindow, onDismiss, onSplitH, onSplitV, onDetach, onReattach, onClose }: Props): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (menuRef.current?.contains(e.target as Node)) return
      onDismiss()
    }
    document.addEventListener('mousedown', handler, { capture: true })
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handler, { capture: true })
      document.removeEventListener('contextmenu', handler, { capture: true })
    }
  }, [onDismiss])

  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 160)

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-48"
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      <MenuItem icon={<Columns2 size={12} />} label="Split Horizontal" onClick={() => { onSplitH(); onDismiss() }} />
      <MenuItem icon={<Rows2 size={12} />} label="Split Vertical" onClick={() => { onSplitV(); onDismiss() }} />
      <div className="h-px bg-brand-panel my-1" />
      {isMainWindow
        ? <MenuItem icon={<ExternalLink size={12} />} label="Detach to Window" onClick={() => { onDetach(); onDismiss() }} />
        : <MenuItem icon={<PanelLeftOpen size={12} />} label="Reattach to Main" onClick={() => { onReattach(); onDismiss() }} />
      }
      <div className="h-px bg-brand-panel my-1" />
      <MenuItem
        icon={<X size={12} />}
        label="Close Pane"
        onClick={() => { onClose(); onDismiss() }}
        className="text-red-400 hover:text-red-300"
      />
    </div>,
    document.body
  )
}
