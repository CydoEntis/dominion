import * as nodePty from 'node-pty'
import { webContents } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { SCROLLBACK_BYTE_LIMIT } from '@shared/constants'
import type { AgentStatus, SessionDataPayload } from '@shared/ipc-types'

interface PtyOptions {
  sessionId: string
  command: string
  args: string[]
  cwd: string
  cols: number
  rows: number
  onCwdChange?: (cwd: string) => void
  onAgentStatus?: (status: AgentStatus) => void
  onConversationId?: (id: string) => void
}

// Claude Code activity signals.
// On Windows, the spinner is rendered as CR + "*" + CR (cursor then repositioned via escape sequence
// to print the word). After ANSI stripping the pattern is literally \r*\r — match that directly.
// "thinking" covers extended-thinking pauses where \r*\r updates slow to >3s intervals.
// "esc to interrupt" appears as plain text during tool execution.
const AGENT_RUNNING_RE = /\r[*]\r|thinking|esc to interrupt/

// Strips ANSI escape sequences (standard + DEC private mode) so color codes don't break pattern matching.
const ANSI_RE = /\x1b\[[\x3c-\x3f]?[0-9;]*[A-Za-z]|\x1b[()][AB012]/g

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
  private readonly onAgentStatus?: (status: AgentStatus) => void
  private readonly onConversationId?: (id: string) => void
  private agentStatus: AgentStatus = 'idle'
  private waitingTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private detectionBuffer = ''
  readonly sessionId: string
  readonly subscriberIds = new Set<number>()

  constructor(opts: PtyOptions) {
    this.sessionId = opts.sessionId
    this.onCwdChange = opts.onCwdChange
    this.onAgentStatus = opts.onAgentStatus
    this.onConversationId = opts.onConversationId

    this.pty = nodePty.spawn(opts.command, opts.args, {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd,
      env: { ...process.env }
    })

    this.pty.onData((data) => {
      this.appendScrollback(data)
      this.detectAgentStatus(data)
      this.fanOut(data)
    })
  }

  private setAgentStatus(status: AgentStatus): void {
    if (this.agentStatus === status) return
    this.agentStatus = status
    this.onAgentStatus?.(status)
  }

  private detectAgentStatus(chunk: string): void {
    this.detectionBuffer = (this.detectionBuffer + chunk).slice(-600)
    const plain = this.detectionBuffer.replace(ANSI_RE, '')
    if (!AGENT_RUNNING_RE.test(plain)) return
    this.detectionBuffer = ''

    this.setAgentStatus('running')

    // Clear any pending transition timers — agent is still active
    if (this.waitingTimer) { clearTimeout(this.waitingTimer); this.waitingTimer = null }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null }

    // After 8s of no spinner/thinking activity → waiting-input
    this.waitingTimer = setTimeout(() => {
      this.setAgentStatus('waiting-input')
      // After 10s of waiting with no new activity → idle
      this.idleTimer = setTimeout(() => {
        this.setAgentStatus('idle')
      }, 10_000)
    }, 8_000)
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
    if (match && match[0] !== this.conversationId) {
      this.conversationId = match[0]
      this.onConversationId?.(match[0])
    }

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
    if (this.waitingTimer) clearTimeout(this.waitingTimer)
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.pty.kill(signal)
  }
}
