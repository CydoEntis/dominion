import { useState, useEffect } from 'react'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'

export function useWindowMaximized(): boolean {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    return ipc.on(IPC.WINDOW_MAXIMIZED_CHANGE, (payload) => {
      setIsMaximized((payload as { maximized: boolean }).maximized)
    })
  }, [])

  return isMaximized
}
