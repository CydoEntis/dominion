import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import type { PersistedLayout } from '@shared/ipc-types'
import { getDataDir } from '../../lib/paths'

function layoutPath(): string {
  const dataDir = getDataDir()
  mkdirSync(dataDir, { recursive: true })
  const newPath = join(dataDir, 'layout.json')
  const oldPath = join(app.getPath('userData'), 'layout.json')
  if (!existsSync(newPath) && existsSync(oldPath)) {
    try { copyFileSync(oldPath, newPath) } catch {}
  }
  return newPath
}

export function getPersistedLayout(): PersistedLayout | null {
  const path = layoutPath()
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'))
    if (raw?.version !== 1 || !Array.isArray(raw.tabs)) return null
    return raw as PersistedLayout
  } catch {
    return null
  }
}

export function savePersistedLayout(layout: PersistedLayout): void {
  const path = layoutPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(layout), 'utf-8')
}

export function clearPersistedLayout(): void {
  const path = layoutPath()
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify(null), 'utf-8')
  }
}
