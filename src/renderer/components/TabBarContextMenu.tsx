import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

interface Props {
  x: number
  y: number
  tabId: string
  tabOrder: string[]
  onClose: (tabIds: string[]) => void
  onDismiss: () => void
}

function Item({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors',
        disabled && 'opacity-30 pointer-events-none'
      )}
    >
      {label}
    </button>
  )
}

function Divider(): JSX.Element {
  return <div className="h-px bg-brand-panel my-1" />
}

export function TabBarContextMenu({ x, y, tabId, tabOrder, onClose, onDismiss }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const idx = tabOrder.indexOf(tabId)
  const toLeft = tabOrder.slice(0, idx)
  const toRight = tabOrder.slice(idx + 1)
  const others = [...toLeft, ...toRight]

  useEffect(() => {
    const onMouse = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      onDismiss()
    }
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('mousedown', onMouse, { capture: true })
    document.addEventListener('contextmenu', onMouse, { capture: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse, { capture: true })
      document.removeEventListener('contextmenu', onMouse, { capture: true })
      document.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])

  const adjustedX = Math.min(x, window.innerWidth - 210)
  const adjustedY = Math.min(y, window.innerHeight - 220)

  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-52"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Item label="Close Tab" onClick={dismiss(() => onClose([tabId]))} />
      <Item
        label="Close Others"
        onClick={dismiss(() => onClose(others))}
        disabled={others.length === 0}
      />
      <Divider />
      <Item
        label="Close Tabs to Left"
        onClick={dismiss(() => onClose(toLeft))}
        disabled={toLeft.length === 0}
      />
      <Item
        label="Close Tabs to Right"
        onClick={dismiss(() => onClose(toRight))}
        disabled={toRight.length === 0}
      />
      <Divider />
      <Item
        label="Close All"
        onClick={dismiss(() => onClose([...tabOrder]))}
      />
    </div>,
    document.body
  )
}
