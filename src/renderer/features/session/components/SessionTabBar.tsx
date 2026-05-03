import { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../../../store/root.store'
import { SessionTab } from './SessionTab'
import { TabBarContextMenu } from '../../../components/TabBarContextMenu'
import { killSession } from '../session.service'
import { useConfirmClose } from '../hooks/useConfirmClose'

interface CtxTarget {
  x: number
  y: number
  tabId: string
}

export function SessionTabBar(): JSX.Element {
  const tabOrder = useStore((s) => s.tabOrder)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const removeTab = useStore((s) => s.removeTab)

  const [ctx, setCtx] = useState<CtxTarget | null>(null)
  const { requestClose, modal: closeModal } = useConfirmClose()
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

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, tabId })
  }, [])

  const handleCloseTabs = useCallback((tabIds: string[]) => {
    requestClose(async () => {
      await Promise.all(tabIds.map((id) => killSession(id).catch(() => {})))
      tabIds.forEach((id) => removeTab(id))
    })
  }, [removeTab, requestClose])

  return (
    <>
      <div
        ref={scrollRef}
        className="flex items-center h-full overflow-x-scroll gap-0 flex-1 min-w-0"
      >
        {tabOrder.map((sessionId) => {
          const meta = sessions[sessionId]
          if (!meta) return null
          return (
            <SessionTab
              key={sessionId}
              meta={meta}
              isActive={activeSessionId === sessionId}
              onActivate={() => setActiveSession(sessionId)}
              onContextMenu={(e) => handleContextMenu(e, sessionId)}
            />
          )
        })}
      </div>

      {ctx && (
        <TabBarContextMenu
          x={ctx.x}
          y={ctx.y}
          tabId={ctx.tabId}
          tabOrder={tabOrder}
          onClose={handleCloseTabs}
          onDismiss={() => setCtx(null)}
        />
      )}
      {closeModal}
    </>
  )
}
