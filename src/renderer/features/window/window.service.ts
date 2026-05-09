import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import type { DetachTabResponse, WindowControlAction } from '@shared/ipc-types'

export async function detachNotePreview(noteId: string, fromWindowId: string): Promise<{ newWindowId: string }> {
  return ipc.invoke(IPC.WINDOW_DETACH_NOTE_PREVIEW, { noteId, fromWindowId }) as Promise<{ newWindowId: string }>
}

export async function getWindowId(): Promise<string> {
  const res = (await ipc.invoke(IPC.WINDOW_GET_ID)) as { windowId: string }
  return res.windowId
}

export async function detachTab(sessionId: string, fromWindowId: string): Promise<DetachTabResponse> {
  return ipc.invoke(IPC.WINDOW_DETACH_TAB, { sessionId, fromWindowId }) as Promise<DetachTabResponse>
}

export async function reattachTab(sessionId: string, fromWindowId?: string): Promise<{ success: boolean }> {
  return ipc.invoke(IPC.WINDOW_REATTACH_TAB, { sessionId, fromWindowId }) as Promise<{ success: boolean }>
}

export function sendWindowControl(action: WindowControlAction): void {
  ipc.send(IPC.WINDOW_CONTROL, action)
}

export async function pickFolder(): Promise<string | null> {
  return ipc.invoke(IPC.DIALOG_PICK_FOLDER) as Promise<string | null>
}

export async function pickFile(): Promise<string | null> {
  return ipc.invoke(IPC.DIALOG_PICK_FILE) as Promise<string | null>
}
