import { app } from 'electron'
import { join } from 'path'
import { getSettings } from '../features/settings/settings-store'

export function getDataDir(): string {
  const override = getSettings().dataDirectory
  return override || join(app.getPath('home'), 'Orbit', '.orbit')
}

export function getNotesDir(): string {
  const override = getSettings().notesDirectory
  return override || join(getDataDir(), 'notes')
}

export function getWorktreesDir(): string {
  const override = getSettings().worktreesDirectory
  return override || join(getDataDir(), 'worktrees')
}
