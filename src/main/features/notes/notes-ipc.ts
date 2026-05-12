import { ipcMain, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync, watch as fsWatch } from 'fs'
import type { FSWatcher } from 'fs'

const activeWatchers = new Map<string, FSWatcher>()
import { IPC } from '@shared/ipc-channels'
import type { Note } from '@shared/ipc-types'
import { getSettings, setSettings } from '../settings/settings-store'
import { getNotesDir } from '../../lib/paths'

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function sanitizeTitle(str: string): string {
  return str
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .slice(0, 80)
    .trim() || 'Untitled'
}

function readAllNotes(dir: string): Note[] {
  const notes: Note[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue
    const id = file.slice(0, -3)
    const filePath = join(dir, file)
    try {
      const content = readFileSync(filePath, 'utf-8')
      const { mtimeMs } = statSync(filePath)
      notes.push({ id, content, updatedAt: mtimeMs })
    } catch {
      // skip unreadable files
    }
  }
  return notes
}

app.on('will-quit', () => {
  for (const w of activeWatchers.values()) w.close()
  activeWatchers.clear()
})

export function registerNotesIpc(): void {
  ipcMain.handle(IPC.NOTES_LOAD, (): Note[] => {
    const dir = getNotesDir()
    ensureDir(dir)

    const existingFiles = readdirSync(dir).filter(f => f.endsWith('.md'))
    if (existingFiles.length === 0) {
      // Migrate from old userData/notes location
      const oldDir = join(app.getPath('userData'), 'notes')
      if (oldDir !== dir && existsSync(oldDir)) {
        const oldFiles = readdirSync(oldDir).filter(f => f.endsWith('.md'))
        for (const file of oldFiles) {
          try { writeFileSync(join(dir, file), readFileSync(join(oldDir, file), 'utf-8'), 'utf-8') } catch {}
        }
        if (oldFiles.length > 0) return readAllNotes(dir)
      }
      // Migrate from legacy settings.json notes array
      const { notes: legacy } = getSettings()
      if (legacy.length > 0) {
        for (const note of legacy) {
          writeFileSync(join(dir, `${note.id}.md`), note.content, 'utf-8')
        }
        setSettings({ notes: [] })
      }
    }

    return readAllNotes(dir)
  })

  ipcMain.handle(IPC.NOTES_SAVE, (_event, { id, content }: { id: string; content: string }): void => {
    const dir = getNotesDir()
    ensureDir(dir)
    writeFileSync(join(dir, `${id}.md`), content, 'utf-8')
  })

  ipcMain.handle(IPC.NOTES_DELETE, (_event, { id }: { id: string }): void => {
    const filePath = join(getNotesDir(), `${id}.md`)
    if (existsSync(filePath)) unlinkSync(filePath)
  })

  ipcMain.handle(IPC.NOTES_GET_FILE_PATH, (_event, { id }: { id: string }): string => {
    return join(getNotesDir(), `${id}.md`)
  })

  ipcMain.handle(IPC.NOTES_OPEN_IN_EDITOR, (_event, { noteId, command }: { noteId: string; command: string }): void => {
    const noteFile = join(getNotesDir(), `${noteId}.md`)
    if (!existsSync(noteFile)) return

    const content = readFileSync(noteFile, 'utf-8')
    const firstLine = content.split('\n').find(l => l.trim()) ?? 'Untitled'
    const title = sanitizeTitle(firstLine.trim())
    const tempDir = join(tmpdir(), 'orbit-notes')
    ensureDir(tempDir)
    const tempFile = join(tempDir, `${title}.md`)

    writeFileSync(tempFile, content, 'utf-8')

    activeWatchers.get(noteId)?.close()
    let debounce: ReturnType<typeof setTimeout> | null = null
    const watcher = fsWatch(tempFile, () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        try {
          const updated = readFileSync(tempFile, 'utf-8')
          writeFileSync(noteFile, updated, 'utf-8')
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send(IPC.NOTES_EXTERNAL_UPDATE, { id: noteId, content: updated })
          }
        } catch {}
      }, 300)
    })
    activeWatchers.set(noteId, watcher)

    spawn(command, [tempFile], { detached: true, stdio: 'ignore', shell: true }).unref()
  })
}
