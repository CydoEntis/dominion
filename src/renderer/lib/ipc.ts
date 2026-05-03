import type { IpcBridge } from '@shared/ipc-bridge'

declare global {
  interface Window {
    ipc: IpcBridge
  }
}

export const ipc: IpcBridge = window.ipc
