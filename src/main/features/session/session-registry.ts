import type { SessionMeta } from '@shared/ipc-types'
import type { PtyProcess } from '../../lib/pty-process'

export interface SessionEntry {
  meta: SessionMeta
  pty: PtyProcess
}

const registry = new Map<string, SessionEntry>()

export function registerSession(entry: SessionEntry): void {
  registry.set(entry.meta.sessionId, entry)
}

export function getSession(sessionId: string): SessionEntry | undefined {
  return registry.get(sessionId)
}

export function removeSession(sessionId: string): void {
  registry.delete(sessionId)
}

export function listSessions(): SessionMeta[] {
  return Array.from(registry.values()).map((e) => e.meta)
}

export function updateSessionMeta(sessionId: string, patch: Partial<SessionMeta>): SessionMeta | undefined {
  const entry = registry.get(sessionId)
  if (!entry) return undefined
  entry.meta = { ...entry.meta, ...patch }
  return entry.meta
}

export function unsubscribeWebContents(webContentsId: number): void {
  for (const entry of registry.values()) {
    entry.pty.unsubscribe(webContentsId)
  }
}
