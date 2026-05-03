import type { IpcBridge } from '../../preload/index'

declare global {
  interface Window {
    ipc: IpcBridge
  }
}

export const ipc: IpcBridge = window.ipc
