import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { CreateSessionPayloadSchema, SessionResizePayloadSchema, SessionWritePayloadSchema } from '@shared/ipc-types'
import {
  createSession,
  killSession,
  writeToSession,
  resizeSession,
  listSessions,
  replayAndSubscribe
} from './session-service'

export function registerSessionIpc(): void {
  ipcMain.handle(IPC.SESSION_CREATE, (event, payload) => {
    const parsed = CreateSessionPayloadSchema.parse(payload)
    return createSession(parsed, event.sender.id)
  })

  ipcMain.handle(IPC.SESSION_KILL, (_event, payload: { sessionId: string }) => {
    return { ok: killSession(payload.sessionId) }
  })

  ipcMain.handle(IPC.SESSION_LIST, () => {
    return listSessions()
  })

  ipcMain.handle(IPC.SESSION_REPLAY_REQUEST, (event, payload: { sessionId: string }) => {
    const chunks = replayAndSubscribe(payload.sessionId, event.sender.id)
    return { chunks }
  })

  ipcMain.on(IPC.SESSION_WRITE, (_event, payload) => {
    const parsed = SessionWritePayloadSchema.safeParse(payload)
    if (parsed.success) writeToSession(parsed.data.sessionId, parsed.data.data)
  })

  ipcMain.on(IPC.SESSION_RESIZE, (_event, payload) => {
    const parsed = SessionResizePayloadSchema.safeParse(payload)
    if (parsed.success) resizeSession(parsed.data.sessionId, parsed.data.cols, parsed.data.rows)
  })
}
