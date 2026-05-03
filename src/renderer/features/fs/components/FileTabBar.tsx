import { useState, useCallback, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { TabBarContextMenu } from '../../../components/TabBarContextMenu'
import type { OpenFile } from '../../session/hooks/useFileTabs'

interface CtxTarget {
  x: number
  y: number
  path: string
}

interface Props {
  openFiles: OpenFile[]
  activeFilePath: string | null
  onActivate: (path: string) => void
  onClose: (path: string) => void
}

function shortName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export function FileTabBar({ openFiles, activeFilePath, onActivate, onClose }: Props): JSX.Element {
  const [ctx, setCtx] = useState<CtxTarget | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      el.scrollLeft += e.deltaY + e.deltaX
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, path })
  }, [])

  const handleClosePaths = useCallback((paths: string[]) => {
    paths.forEach((p) => onClose(p))
  }, [onClose])

  const paths = openFiles.map((f) => f.path)

  if (openFiles.length === 0) {
    return <span className="text-xs text-zinc-600 px-3">No files open</span>
  }

  return (
    <>
      <div ref={scrollRef} className="flex items-center h-full overflow-x-scroll flex-1 min-w-0">
        {openFiles.map((f) => {
          const isActive = f.path === activeFilePath
          return (
            <div
              key={f.path}
              onClick={() => onActivate(f.path)}
              onContextMenu={(e) => handleContextMenu(e, f.path)}
              title={f.path}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={cn(
                'relative flex items-center gap-2 px-4 h-full border-r border-brand-panel cursor-pointer flex-shrink-0 min-w-[120px] max-w-[200px] group transition-colors',
                isActive ? 'bg-brand-panel/60 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/30'
              )}
            >
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green" />}
              {f.hasChanges && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
              <span className="text-sm font-medium truncate flex-1">{shortName(f.path)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(f.path) }}
                className={cn(
                  'flex-shrink-0 transition-colors hover:text-zinc-100',
                  isActive ? 'text-zinc-400' : 'text-zinc-700 opacity-0 group-hover:opacity-100'
                )}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {ctx && (
        <TabBarContextMenu
          x={ctx.x}
          y={ctx.y}
          tabId={ctx.path}
          tabOrder={paths}
          onClose={handleClosePaths}
          onDismiss={() => setCtx(null)}
        />
      )}
    </>
  )
}
