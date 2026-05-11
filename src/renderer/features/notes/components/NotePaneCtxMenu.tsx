import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, X, ChevronRight, ArrowRightLeft, Eye } from 'lucide-react'
import { listWindows, highlightWindow } from '../../window/window.service'

interface NotePaneCtxMenuProps {
  ctxMenu: { x: number; y: number }
  isMainWindow: boolean
  onDismiss: () => void
  onDetach: () => void
  onReattach: () => void
  onMoveToWindow: (targetWindowId: string) => void
  onClose: () => void
  onOpenPreview?: () => void
}

export function NotePaneCtxMenu({ ctxMenu, isMainWindow, onDismiss, onDetach, onReattach, onMoveToWindow, onClose, onOpenPreview }: NotePaneCtxMenuProps): JSX.Element {
  const [otherWindows, setOtherWindows] = useState<{ windowId: string; windowName: string; windowColor: string; isMain: boolean }[]>([])
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const [submenuY, setSubmenuY] = useState(0)
  const [hoveredWindowId, setHoveredWindowId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const moveTriggerRef = useRef<HTMLButtonElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightedRef = useRef<string | null>(null)

  const clearHighlight = (): void => {
    if (highlightedRef.current) {
      highlightWindow(highlightedRef.current, false).catch(() => {})
      highlightedRef.current = null
    }
  }

  const clearHideTimeout = (): void => {
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null }
  }

  const scheduleHideSubmenu = (): void => {
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => { setShowMoveSubmenu(false); clearHighlight() }, 150)
  }

  useEffect(() => {
    listWindows().then((wins) => {
      setOtherWindows(wins.map((w) => ({ windowId: w.windowId, windowName: w.windowName, windowColor: w.windowColor, isMain: w.isMain })))
    }).catch(() => {})
    return () => { clearHideTimeout(); clearHighlight() }
  }, [])

  const menuX = Math.min(ctxMenu.x, window.innerWidth - 180)
  const menuY = Math.min(ctxMenu.y, window.innerHeight - 120)

  const getSubmenuX = (): number => {
    const menuWidth = menuRef.current?.offsetWidth ?? 164
    const submenuWidth = 160
    const rightX = menuX + menuWidth + 4
    return rightX + submenuWidth > window.innerWidth ? menuX - submenuWidth - 4 : rightX
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onMouseDown={onDismiss} onContextMenu={(e) => { e.preventDefault(); onDismiss() }} />
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-brand-surface border border-brand-panel/60 rounded shadow-xl py-1 min-w-[160px]"
        style={{ left: menuX, top: menuY }}
      >
        {onOpenPreview && (
          <>
            <button
              onMouseDown={(e) => { e.stopPropagation(); onOpenPreview(); onDismiss() }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors"
            >
              <Eye size={12} />Open Preview
            </button>
            <div className="my-1 border-t border-brand-panel/60" />
          </>
        )}
        <button
          ref={moveTriggerRef}
          onMouseEnter={() => {
            clearHideTimeout()
            const rect = moveTriggerRef.current?.getBoundingClientRect()
            if (rect) setSubmenuY(rect.top)
            setShowMoveSubmenu(true)
          }}
          onMouseLeave={scheduleHideSubmenu}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors"
        >
          <span className="flex items-center gap-2.5"><ArrowRightLeft size={12} />Move to Window</span>
          <ChevronRight size={10} className="text-zinc-600" />
        </button>
        <div className="my-1 border-t border-brand-panel/60" />
        <button
          onMouseDown={(e) => { e.stopPropagation(); onClose(); onDismiss() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-red-400 hover:bg-brand-panel hover:text-red-300 transition-colors"
        >
          <X size={12} />Close Pane
        </button>
      </div>

      {showMoveSubmenu && (isMainWindow || otherWindows.length > 0) && (
        <div
          className="fixed z-[10000] bg-brand-surface border border-brand-panel/60 rounded shadow-xl py-1 min-w-[140px]"
          style={{ left: getSubmenuX(), top: submenuY }}
          onMouseEnter={clearHideTimeout}
          onMouseLeave={scheduleHideSubmenu}
        >
          {isMainWindow && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); onDetach(); onDismiss() }}
              onMouseEnter={() => { clearHideTimeout(); setHoveredWindowId('__new__') }}
              onMouseLeave={() => setHoveredWindowId(null)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors"
              style={{ color: hoveredWindowId === '__new__' ? '#f4f4f5' : '#d4d4d8', background: hoveredWindowId === '__new__' ? 'rgba(255,255,255,0.06)' : undefined }}
            >
              <ExternalLink size={11} />New Window
            </button>
          )}
          {isMainWindow && otherWindows.length > 0 && <div className="my-1 border-t border-brand-panel/60" />}
          {otherWindows.map((w) => (
            <button
              key={w.windowId}
              onMouseDown={(e) => { e.stopPropagation(); onMoveToWindow(w.windowId); onDismiss() }}
              onMouseEnter={() => {
                clearHideTimeout()
                setHoveredWindowId(w.windowId)
                if (highlightedRef.current && highlightedRef.current !== w.windowId) highlightWindow(highlightedRef.current, false).catch(() => {})
                highlightedRef.current = w.windowId
                highlightWindow(w.windowId, true).catch(() => {})
              }}
              onMouseLeave={() => setHoveredWindowId(null)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors"
              style={{
                color: hoveredWindowId === w.windowId ? '#f4f4f5' : '#d4d4d8',
                backgroundImage: `linear-gradient(to right, ${w.windowColor}${hoveredWindowId === w.windowId ? '40' : '20'} 0%, transparent 70%)`,
              }}
            >
              {w.windowName}
            </button>
          ))}
        </div>
      )}
    </>,
    document.body
  )
}
