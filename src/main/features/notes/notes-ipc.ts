import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs'
import { IPC } from '@shared/ipc-channels'
import type { Note } from '@shared/ipc-types'
import { getSettings, setSettings } from '../settings/settings-store'

function getNotesDir(): string {
  const dir = getSettings().notesDirectory
  return dir || join(app.getPath('userData'), 'notes')
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
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

export function registerNotesIpc(): void {
  ipcMain.handle(IPC.NOTES_LOAD, (): Note[] => {
    const dir = getNotesDir()
    ensureDir(dir)

    // One-time migration: if no .md files exist yet, move notes out of settings.json
    const existingFiles = readdirSync(dir).filter(f => f.endsWith('.md'))
    if (existingFiles.length === 0) {
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
}
