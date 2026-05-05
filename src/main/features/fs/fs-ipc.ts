import { ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { IPC } from '@shared/ipc-channels'
import type { FsEntry, GitStatusEntry } from '@shared/ipc-types'

const CANDIDATE_EDITORS = [
  { name: 'VS Code', command: 'code' },
  { name: 'Cursor', command: 'cursor' },
  { name: 'Zed', command: 'zed' },
  { name: 'Sublime Text', command: 'subl' },
  { name: 'Notepad++', command: 'notepad++' },
]

const execAsync = promisify(exec)
const IGNORE = new Set(['.git', 'node_modules', 'dist', 'out', '.next', '__pycache__'])
const MAX_FILE_BYTES = 5_000_000

async function detectShells(): Promise<{ name: string; path: string }[]> {
  const available: { name: string; path: string }[] = []

  if (process.platform === 'win32') {
    // PowerShell Core — scan versioned install dir
    try {
      const psDir = 'C:\\Program Files\\PowerShell'
      const versions = await fs.readdir(psDir)
      for (const v of [...versions].sort().reverse()) {
        const p = `${psDir}\\${v}\\pwsh.exe`
        try { await fs.access(p); available.push({ name: `PowerShell ${v}`, path: p }); break } catch {}
      }
    } catch {}

    const winCandidates = [
      { name: 'Windows PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
      { name: 'Command Prompt (cmd)', path: 'C:\\Windows\\System32\\cmd.exe' },
      { name: 'Git Bash', path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
      { name: 'Git Bash (x86)', path: 'C:\\Program Files (x86)\\Git\\bin\\bash.exe' },
      { name: 'WSL', path: 'C:\\Windows\\System32\\wsl.exe' },
    ]
    for (const c of winCandidates) {
      try { await fs.access(c.path); available.push(c) } catch {}
    }
  } else {
    const unixCandidates = [
      { name: 'zsh', path: '/bin/zsh' },
      { name: 'bash', path: '/bin/bash' },
      { name: 'sh', path: '/bin/sh' },
      { name: 'fish', path: '/usr/bin/fish' },
      { name: 'zsh (Homebrew)', path: '/usr/local/bin/zsh' },
      { name: 'bash (Homebrew)', path: '/usr/local/bin/bash' },
      { name: 'fish (Homebrew)', path: '/usr/local/bin/fish' },
      { name: 'zsh (Homebrew M1)', path: '/opt/homebrew/bin/zsh' },
      { name: 'bash (Homebrew M1)', path: '/opt/homebrew/bin/bash' },
      { name: 'fish (Homebrew M1)', path: '/opt/homebrew/bin/fish' },
    ]
    for (const c of unixCandidates) {
      try { await fs.access(c.path); available.push(c) } catch {}
    }
  }

  return available
}

export function registerFsIpc(): void {
  ipcMain.handle(IPC.FS_DETECT_SHELLS, async () => detectShells())

  ipcMain.handle(IPC.FS_READ_DIR, async (_, { dirPath }: { dirPath: string }): Promise<FsEntry[]> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !IGNORE.has(e.name))
      .map((e) => ({ name: e.name, path: join(dirPath, e.name), isDirectory: e.isDirectory() }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  })

  ipcMain.handle(IPC.FS_READ_FILE, async (_, { filePath }: { filePath: string }): Promise<string | null> => {
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_FILE_BYTES) return `[File too large to display: ${(stat.size / 1024).toFixed(0)} KB]`
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.FS_GIT_STATUS, async (_, { projectRoot }: { projectRoot: string }): Promise<GitStatusEntry[]> => {
    try {
      const { stdout } = await execAsync('git status --porcelain -u', { cwd: projectRoot })
      return stdout.trim().split('\n').filter(Boolean).map((line) => ({
        xy: line.slice(0, 2),
        path: line.slice(3).trim().replace(/^"(.+)"$/, '$1')
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC.FS_SHOW_IN_FOLDER, (_event, { filePath }: { filePath: string }) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC.FS_OPEN_PATH, (_event, { filePath }: { filePath: string }) => {
    return shell.openPath(filePath)
  })

  ipcMain.handle(IPC.FS_OPEN_IN_EDITOR, (_event, { command, filePath }: { command: string; filePath: string }) => {
    spawn(command, [filePath], { detached: true, stdio: 'ignore' }).unref()
  })

  ipcMain.handle(IPC.FS_DETECT_EDITORS, async () => {
    const probe = process.platform === 'win32' ? 'where' : 'which'
    const results = await Promise.all(
      CANDIDATE_EDITORS.map(async (e) => {
        try {
          await execAsync(`${probe} ${e.command}`)
          return e
        } catch {
          return null
        }
      })
    )
    return results.filter(Boolean)
  })

  ipcMain.handle(IPC.FS_RENAME, async (_event, { oldPath, newName }: { oldPath: string; newName: string }) => {
    const newPath = join(dirname(oldPath), newName)
    await fs.rename(oldPath, newPath)
  })

  ipcMain.handle(IPC.FS_TRASH, async (_event, { filePath }: { filePath: string }) => {
    await shell.trashItem(filePath)
  })

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
    return shell.openExternal(url)
  })

  ipcMain.handle(IPC.FS_GIT_DIFF_FILE, async (_, { projectRoot, filePath }: { projectRoot: string; filePath: string }): Promise<string | null> => {
    const rel = filePath.replace(/\\/g, '/')
    try {
      const { stdout: wd } = await execAsync(`git diff -- "${rel}"`, { cwd: projectRoot })
      if (wd) return wd
      const { stdout: st } = await execAsync(`git diff --cached -- "${rel}"`, { cwd: projectRoot })
      if (st) return st
      // Untracked files: git diff --no-index exits with code 1 when files differ
      try {
        const { stdout: un } = await execAsync(`git diff --no-index -- /dev/null "${rel}"`, { cwd: projectRoot })
        if (un) return un
      } catch (unErr: any) {
        if (unErr?.stdout) return unErr.stdout as string
      }
      return null
    } catch {
      return null
    }
  })
}
