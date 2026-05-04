import { useEffect } from 'react'
import { toast } from 'sonner'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'

export function useAutoUpdater(): void {
  useEffect(() => {
    const offAvailable = ipc.on(IPC.UPDATE_AVAILABLE, (payload) => {
      const { version } = payload as { version: string }
      toast.info(`Update v${version} is downloading…`, { duration: 4000 })
    })

    const offDownloaded = ipc.on(IPC.UPDATE_DOWNLOADED, (payload) => {
      const { version } = payload as { version: string }
      toast.success(`Dominion v${version} ready`, {
        duration: Infinity,
        description: 'Restart to apply the update.',
        action: {
          label: 'Restart',
          onClick: () => ipc.invoke(IPC.UPDATE_INSTALL)
        }
      })
    })

    return () => {
      offAvailable()
      offDownloaded()
    }
  }, [])
}
