import { useEffect } from 'react'
import { toast } from 'sonner'
import { ipc } from '../../../lib/ipc'
import { IPC } from '@shared/ipc-channels'

function showUpdateToast(version: string): void {
  toast.success(`Orbit v${version} ready`, {
    duration: Infinity,
    description: 'Restart to apply the update.',
    action: {
      label: 'Restart',
      onClick: () => ipc.invoke(IPC.UPDATE_INSTALL)
    }
  })
}

export function useAutoUpdater(): void {
  useEffect(() => {
    // Check for an update that finished downloading before this renderer mounted
    ipc.invoke(IPC.UPDATE_GET_PENDING).then((pending) => {
      if (pending) {
        const { version } = pending as { version: string }
        showUpdateToast(version)
      }
    }).catch(() => {})

    const offAvailable = ipc.on(IPC.UPDATE_AVAILABLE, (payload) => {
      const { version } = payload as { version: string }
      toast.info(`Update v${version} is downloading…`, { duration: 4000 })
    })

    const offDownloaded = ipc.on(IPC.UPDATE_DOWNLOADED, (payload) => {
      const { version } = payload as { version: string }
      showUpdateToast(version)
    })

    return () => {
      offAvailable()
      offDownloaded()
    }
  }, [])
}
