import { useState, useRef, useCallback } from 'react'

export function useSidebarResize(initialWidth = 224): {
  sidebarWidth: number
  handleSidebarDragStart: (e: React.MouseEvent) => void
} {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleSidebarDragStart = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: sidebarWidth }
    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      const next = Math.max(160, Math.min(480, dragRef.current.startWidth + ev.clientX - dragRef.current.startX))
      setSidebarWidth(next)
    }
    const onUp = (): void => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  return { sidebarWidth, handleSidebarDragStart }
}
