import * as nodePty from 'node-pty'
import { webContents } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { SCROLLBACK_BYTE_LIMIT } from '@shared/constants'
import type { SessionDataPayload } from '@shared/ipc-types'

interface PtyOptions {
  sessionId: string
  command: string
  args: string[]
  cwd: string
  cols: number
  rows: number
  onCwdChange?: (cwd: string) => void
}

// UUID v4 pattern — used to detect Claude conversation IDs from PTY output
const UUID_V4_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
// OSC 7 — emitted by shells/Claude Code when the working directory changes
const OSC7_RE = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*?)(?:\x07|\x1b\\)/

export class PtyProcess {
  private pty: nodePty.IPty
  private scrollback: string[] = []
  private scrollbackBytes = 0
  private conversationId: string | undefined
  private readonly onCwdChange?: (cwd: string) => void
  readonly sessionId: string
  readonly subscriberIds = new Set<number>()

  constructor(opts: PtyOptions) {
    this.sessionId = opts.sessionId
    this.onCwdChange = opts.onCwdChange

    this.pty = nodePty.spawn(opts.command, opts.args, {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd,
      env: { ...process.env }
    })

    this.pty.onData((data) => {
      this.appendScrollback(data)
      this.fanOut(data)
    })
  }

  private appendScrollback(chunk: string): void {
    const bytes = Buffer.byteLength(chunk, 'utf8')
    this.scrollback.push(chunk)
    this.scrollbackBytes += bytes

    while (this.scrollbackBytes > SCROLLBACK_BYTE_LIMIT && this.scrollback.length > 1) {
      const removed = this.scrollback.shift()!
      this.scrollbackBytes -= Buffer.byteLength(removed, 'utf8')
    }

    const match = UUID_V4_RE.exec(chunk)
    if (match) this.conversationId = match[0]

    const osc7 = OSC7_RE.exec(chunk)
    if (osc7) {
      try {
        let cwd = decodeURIComponent(osc7[1])
        if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(cwd)) cwd = cwd.slice(1)
        this.onCwdChange?.(cwd)
      } catch { /* ignore malformed URI */ }
    }
  }

  getConversationId(): string | undefined {
    return this.conversationId
  }

  private fanOut(data: string): void {
    const payload: SessionDataPayload = { sessionId: this.sessionId, data }
    for (const id of this.subscriberIds) {
      const wc = webContents.fromId(id)
      if (wc && !wc.isDestroyed()) {
        wc.send(IPC.SESSION_DATA, payload)
      } else {
        this.subscriberIds.delete(id)
      }
    }
  }

  subscribe(webContentsId: number): void {
    this.subscriberIds.add(webContentsId)
  }

  unsubscribe(webContentsId: number): void {
    this.subscriberIds.delete(webContentsId)
  }

  getScrollback(): string[] {
    return [...this.scrollback]
  }

  write(data: string): void {
    this.pty.write(data)
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows)
  }

  get pid(): number | undefined {
    return this.pty.pid
  }

  onExit(cb: (exitCode: number) => void): void {
    this.pty.onExit(({ exitCode }) => cb(exitCode))
  }

  kill(signal?: string): void {
    this.pty.kill(signal)
  }
}
