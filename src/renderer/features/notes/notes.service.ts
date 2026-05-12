import { ipc } from '@renderer/lib/ipc'
import { IPC } from '@shared/ipc-channels'

export function getNoteFilePath(id: string): Promise<string> {
  return ipc.invoke(IPC.NOTES_GET_FILE_PATH, { id }) as Promise<string>
}

export function openNoteInEditor(command: string, noteId: string): Promise<void> {
  return ipc.invoke(IPC.NOTES_OPEN_IN_EDITOR, { command, noteId }) as Promise<void>
}
