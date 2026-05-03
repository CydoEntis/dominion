import { ipc } from '../../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import type { CreateSessionPayload, SessionMeta, SessionWritePayload, SessionResizePayload } from '@shared/ipc-types'

export async function createSession(payload: CreateSessionPayload): Promise<SessionMeta> {
  return ipc.invoke(IPC.SESSION_CREATE, payload) as Promise<SessionMeta>
}

export async function killSession(sessionId: string): Promise<{ ok: boolean }> {
  return ipc.invoke(IPC.SESSION_KILL, { sessionId }) as Promise<{ ok: boolean }>
}

export async function listSessions(): Promise<SessionMeta[]> {
  return ipc.invoke(IPC.SESSION_LIST) as Promise<SessionMeta[]>
}

export async function replayRequest(sessionId: string): Promise<{ chunks: string[] }> {
  return ipc.invoke(IPC.SESSION_REPLAY_REQUEST, { sessionId }) as Promise<{ chunks: string[] }>
}

export function writeToSession(payload: SessionWritePayload): void {
  ipc.send(IPC.SESSION_WRITE, payload)
}

export function resizeSession(payload: SessionResizePayload): void {
  ipc.send(IPC.SESSION_RESIZE, payload)
}

export async function patchSession(payload: { sessionId: string; name?: string; color?: string }): Promise<SessionMeta> {
  return ipc.invoke(IPC.SESSION_PATCH, payload) as Promise<SessionMeta>
}
