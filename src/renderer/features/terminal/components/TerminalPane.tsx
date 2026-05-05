import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTerminal } from '../hooks/useTerminal'

interface Props {
  sessionId: string
}

export function TerminalPane({ sessionId }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { ctxMenu, dismissCtxMenu } = useTerminal(sessionId, containerRef)

  return (
    <>
      <div
        ref={containerRef}
        className="xterm-container"
        style={{ width: '100%', height: '100%', padding: '4px 8px' }}
      />
      {ctxMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={dismissCtxMenu}
            onContextMenu={(e) => { e.preventDefault(); dismissCtxMenu() }}
          />
          <div
            className="fixed z-[9999] bg-brand-surface border border-brand-panel/60 rounded shadow-xl py-1 min-w-[140px]"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {ctxMenu.items.map((item, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.stopPropagation(); item.action(); dismissCtxMenu() }}
                className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
