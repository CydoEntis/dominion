import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import type { FsEntry, GitStatusEntry } from '@shared/ipc-types'

export async function readDir(dirPath: string): Promise<FsEntry[]> {
  return ipc.invoke(IPC.FS_READ_DIR, { dirPath }) as Promise<FsEntry[]>
}

export async function readFile(filePath: string): Promise<string | null> {
  return ipc.invoke(IPC.FS_READ_FILE, { filePath }) as Promise<string | null>
}

export async function getGitStatus(projectRoot: string): Promise<GitStatusEntry[]> {
  return ipc.invoke(IPC.FS_GIT_STATUS, { projectRoot }) as Promise<GitStatusEntry[]>
}

export async function getGitDiff(projectRoot: string, filePath: string): Promise<string | null> {
  return ipc.invoke(IPC.FS_GIT_DIFF_FILE, { projectRoot, filePath }) as Promise<string | null>
}

export function showInFolder(filePath: string): Promise<void> {
  return ipc.invoke(IPC.FS_SHOW_IN_FOLDER, { filePath }) as Promise<void>
}

export function openPath(filePath: string): Promise<string> {
  return ipc.invoke(IPC.FS_OPEN_PATH, { filePath }) as Promise<string>
}

export function openInEditor(command: string, filePath: string): Promise<void> {
  return ipc.invoke(IPC.FS_OPEN_IN_EDITOR, { command, filePath }) as Promise<void>
}

export async function detectEditors(): Promise<{ name: string; command: string }[]> {
  return ipc.invoke(IPC.FS_DETECT_EDITORS) as Promise<{ name: string; command: string }[]>
}

export async function renameEntry(oldPath: string, newName: string): Promise<void> {
  return ipc.invoke(IPC.FS_RENAME, { oldPath, newName }) as Promise<void>
}

export async function trashEntry(filePath: string): Promise<void> {
  return ipc.invoke(IPC.FS_TRASH, { filePath }) as Promise<void>
}

export function openExternal(url: string): Promise<void> {
  return ipc.invoke(IPC.SHELL_OPEN_EXTERNAL, { url }) as Promise<void>
}
