import { randomUUID } from 'crypto'
import { webContents } from 'electron'
import { PtyProcess } from '../../lib/pty-process'
import {
  registerSession,
  getSession,
  removeSession,
  listSessions,
  updateSessionMeta
} from './session-registry'
import { IPC } from '@shared/ipc-channels'
import type {
  CreateSessionPayload,
  SessionMeta,
  SessionExitPayload
} from '@shared/ipc-types'

function resolveShellSpawn(agentCommand?: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    const shell = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe'
    return agentCommand
      ? { command: shell, args: ['/k', agentCommand] }
      : { command: shell, args: [] }
  }
  const shell = process.env.SHELL || '/bin/bash'
  return agentCommand
    ? { command: shell, args: ['-c', `${agentCommand}; exec ${shell}`] }
    : { command: shell, args: [] }
}

export function createSession(
  payload: CreateSessionPayload,
  subscriberWebContentsId?: number
): SessionMeta {
  const sessionId = randomUUID()
  const cwd = payload.cwd || process.env.USERPROFILE || process.env.HOME || process.cwd()
  const { command, args } = resolveShellSpawn(payload.agentCommand)

  const meta: SessionMeta = {
    sessionId,
    name: payload.name,
    agentCommand: payload.agentCommand,
    command,
    args,
    cwd,
    status: 'running',
    exitCode: null,
    createdAt: Date.now(),
    pid: null,
    color: payload.color,
    agentStatus: 'idle'
  }

  const pty = new PtyProcess({
    sessionId,
    command,
    args,
    cwd,
    cols: payload.cols,
    rows: payload.rows,
    onCwdChange: (newCwd) => {
      const updated = updateSessionMeta(sessionId, { cwd: newCwd })
      if (updated) broadcastMetaUpdate(updated)
    },
    onAgentStatus: (agentStatus) => {
      const updated = updateSessionMeta(sessionId, { agentStatus })
      if (updated) broadcastMetaUpdate(updated)
    },
    onConversationId: (conversationId) => {
      const updated = updateSessionMeta(sessionId, { conversationId })
      if (updated) broadcastMetaUpdate(updated)
    }
  })

  meta.pid = pty.pid ?? null

  if (subscriberWebContentsId != null) {
    pty.subscribe(subscriberWebContentsId)
  }

  pty.onExit((exitCode) => {
    const updated = updateSessionMeta(sessionId, { status: 'exited', exitCode })
    if (updated) broadcastMetaUpdate(updated)
    const exitPayload: SessionExitPayload = { sessionId, exitCode }
    for (const id of pty.subscriberIds) {
      const wc = webContents.fromId(id)
      if (wc && !wc.isDestroyed()) {
        wc.send(IPC.SESSION_EXIT, exitPayload)
      }
    }
  })

  registerSession({ meta, pty })
  return meta
}

export function killSession(sessionId: string): boolean {
  const entry = getSession(sessionId)
  if (!entry) return false
  entry.pty.kill()
  const updated = updateSessionMeta(sessionId, { status: 'killed' })
  if (updated) broadcastMetaUpdate(updated)
  removeSession(sessionId)
  return true
}

export function writeToSession(sessionId: string, data: string): void {
  getSession(sessionId)?.pty.write(data)
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  getSession(sessionId)?.pty.resize(cols, rows)
}

export { listSessions }

export function patchSession(sessionId: string, patch: { name?: string; color?: string }): SessionMeta | undefined {
  const updated = updateSessionMeta(sessionId, patch)
  if (updated) broadcastMetaUpdate(updated)
  return updated
}

export function replayAndSubscribe(sessionId: string, webContentsId: number): string[] {
  const entry = getSession(sessionId)
  if (!entry) return []
  entry.pty.subscribe(webContentsId) // subscribe FIRST — no race gap
  return entry.pty.getScrollback()
}

function broadcastMetaUpdate(meta: SessionMeta): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) {
      wc.send(IPC.SESSION_META_UPDATE, meta)
    }
  }
}
