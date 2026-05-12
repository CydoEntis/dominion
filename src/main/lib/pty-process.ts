import * as nodePty from 'node-pty'
import { webContents } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { SCROLLBACK_BYTE_LIMIT } from '@shared/constants'
import type { AgentStatus, SessionDataPayload } from '@shared/ipc-types'
import { getShellIntegrationSequence } from './shell-integration'

interface PtyOptions {
  sessionId: string
  command: string
  args: string[]
  cwd: string
  cols: number
  rows: number
  skipShellIntegration?: boolean
  onCwdChange?: (cwd: string) => void
  onAgentStatus?: (status: AgentStatus) => void
  onConversationId?: (id: string) => void
}

// OSC 9;4 — Windows Terminal progress protocol, emitted by Claude Code itself.
//   9;4;3 → indeterminate / working  (Claude started processing)
//   9;4;0 → clear / done             (Claude finished, prompt returning)
//   9;4;1 → success, 9;4;2 → error   (also treated as done)
const OSC94_WORKING_RE = /\x1b\]9;4;3(?:\x07|\x1b\\)/
const OSC94_DONE_RE = /\x1b\]9;4;[012](?:\x07|\x1b\\)/

// OSC 633 — VS Code shell integration protocol, emitted by Orbit's own shell
// integration injection (shell-integration.ts). Zero-timer, data-driven signals:
//   633;C → command executing (fired instantly on Enter via PSConsoleHostReadLine
//            override in PowerShell, DEBUG trap in bash, preexec hook in zsh/fish)
//   633;A → prompt start (fired when shell is idle and showing its prompt)
const OSC633_C_RE = /\x1b\]633;C(?:\x07|\x1b\\)/
const OSC633_A_RE = /\x1b\]633;A(?:\x07|\x1b\\)/

// Regex fallback for Claude Code's own interactive output (Claude Code does not
// emit OSC 633 — these fire for per-message status within a claude session).
// \r*\r   — Windows spinner (CR + "*" + CR, repositioned by ANSI).
// \n•\s   — U+2022 bullet Claude prefixes every response with.
// esc to interrupt — shown in Claude Code's UI during tool execution.
// NOTE: "thinking" was intentionally removed — it matches response body text
// (e.g. "I was thinking about…") and caused the timer to reset mid-response,
// making the spinner outlast the "> " prompt detection.
const AGENT_RUNNING_RE = /\r[*]\r|\n•\s|esc to interrupt/

// ※ (U+203B) — "※ Cogitated/Crunched/Pondered for Xs" — emitted after thinking.
const AGENT_WRAP_UP_RE = /※/

// Claude Code's input prompt "> " on its own line. Guarded by agentStatus === 'running'
// so regular shell prompts don't false-fire.
const AGENT_PROMPT_RE = /(^|[\r\n])>\s*$/

// Strips ANSI escape sequences (CSI, DEC private mode, and OSC) so control codes
// don't break pattern matching. OSC sequences (\x1b]...\x07 or \x1b]...\x1b\\)
// must also be stripped — Claude Code emits window-title updates that would otherwise
// sit in the plain buffer and block AGENT_PROMPT_RE from matching "> ".
const ANSI_RE = /\x1b\[[\x3c-\x3f]?[0-9;]*[A-Za-z]|\x1b[()][AB012]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g

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
  private cwdBuffer = ''
  private readonly isAgentSession: boolean
  readonly sessionId: string
  readonly subscriberIds = new Set<number>()

  constructor(opts: PtyOptions) {
    this.sessionId = opts.sessionId
    this.isAgentSession = !!opts.skipShellIntegration
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

    // Inject shell integration ~300 ms after the shell has initialised its
    // RC files.  We do this here rather than in session-service so the PTY
    // class owns the full lifecycle of the underlying process.
    // Skip when an agentCommand is set — the shell immediately spawns claude,
    // so the 300 ms timer fires while claude owns stdin and the script would
    // be echoed as visible text instead of executed by the shell interpreter.
    const integrationSeq = opts.skipShellIntegration ? null : getShellIntegrationSequence(opts.command, process.platform)
    if (integrationSeq) {
      setTimeout(() => {
        try { this.pty.write(integrationSeq) } catch { /* pty may have exited already */ }
      }, 300)
    }
  }

  private setAgentStatus(status: AgentStatus): void {
    if (this.agentStatus === status) return
    this.agentStatus = status
    this.onAgentStatus?.(status)
  }

  private clearActivityTimers(): void {
    if (this.waitingTimer) { clearTimeout(this.waitingTimer); this.waitingTimer = null }
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null }
  }

  private detectAgentStatus(chunk: string): void {
    this.detectionBuffer = (this.detectionBuffer + chunk).slice(-600)

    // OSC 9;4 — Claude Code emits this directly to signal progress state.
    // Highest priority: no timer, direct signal from the AI tool itself.
    // DONE is checked before WORKING: when both arrive in the same PTY chunk (fast
    // single-turn responses), DONE is more recent and must win so we don't stay stuck
    // in 'running' until the fallback timer fires.
    if (OSC94_DONE_RE.test(this.detectionBuffer)) {
      this.detectionBuffer = ''
      this.clearActivityTimers()
      this.setAgentStatus('waiting-input')
      this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
      return
    }
    if (OSC94_WORKING_RE.test(this.detectionBuffer)) {
      this.detectionBuffer = ''
      this.clearActivityTimers()
      this.setAgentStatus('running')
      return
    }

    // OSC 633 — primary path, emitted by Orbit's shell integration injection.
    // These are data-driven and fire with zero timer lag.
    if (OSC633_C_RE.test(this.detectionBuffer)) {
      this.detectionBuffer = ''
      this.clearActivityTimers()
      this.setAgentStatus('running')
      // Safety net: if 633;A never arrives (very long command), fall back after 60s.
      this.waitingTimer = setTimeout(() => {
        this.setAgentStatus('waiting-input')
        this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
      }, 60_000)
      return
    }

    if (OSC633_A_RE.test(this.detectionBuffer)) {
      this.detectionBuffer = ''
      this.clearActivityTimers()
      this.setAgentStatus('waiting-input')
      this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
      return
    }

    // Regex fallback — for Claude Code's per-message status within a claude session
    // (Claude Code does not emit OSC 633 itself).
    const plain = this.detectionBuffer.replace(ANSI_RE, '')

    // Claude's prompt appearing while running = just finished. agentStatus guard
    // prevents shell prompts from false-firing when not in a claude interaction.
    if (this.agentStatus === 'running' && AGENT_PROMPT_RE.test(plain)) {
      this.clearActivityTimers()
      this.detectionBuffer = ''
      this.setAgentStatus('waiting-input')
      this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
      return
    }

    const isRunning = AGENT_RUNNING_RE.test(plain)
    const isWrappingUp = AGENT_WRAP_UP_RE.test(plain)
    if (!isRunning && !isWrappingUp) return

    // Prompt already visible in this same chunk — skip the timer entirely.
    // This fires when Claude finishes fast and the final bullet + "> " arrive together.
    if (AGENT_PROMPT_RE.test(plain)) {
      this.detectionBuffer = ''
      this.clearActivityTimers()
      this.setAgentStatus('waiting-input')
      this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
      return
    }

    this.detectionBuffer = ''
    this.setAgentStatus('running')
    this.clearActivityTimers()

    // ※ wins over spinner — 1s fallback. Pure spinner/tool = 1.5s fallback.
    // These are last-resort safety nets; AGENT_PROMPT_RE should fire first in normal flow.
    const waitMs = isWrappingUp ? 1_000 : 1_500
    this.waitingTimer = setTimeout(() => {
      this.setAgentStatus('waiting-input')
      this.idleTimer = setTimeout(() => { this.setAgentStatus('idle') }, 5_000)
    }, waitMs)
  }

  private appendScrollback(chunk: string): void {
    // New Claude Code session detected — clear old scrollback before storing this chunk
    // so replay doesn't show welcome screens from previous runs in the same shell.
    const match = UUID_V4_RE.exec(chunk)
    if (match && match[0] !== this.conversationId) {
      this.scrollback = []
      this.scrollbackBytes = 0
      this.conversationId = match[0]
      this.onConversationId?.(match[0])
    }

    const bytes = Buffer.byteLength(chunk, 'utf8')
    this.scrollback.push(chunk)
    this.scrollbackBytes += bytes

    while (this.scrollbackBytes > SCROLLBACK_BYTE_LIMIT && this.scrollback.length > 1) {
      const removed = this.scrollback.shift()!
      this.scrollbackBytes -= Buffer.byteLength(removed, 'utf8')
    }

    const osc7 = OSC7_RE.exec(chunk)
    if (osc7) {
      try {
        let cwd = decodeURIComponent(osc7[1])
        if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(cwd)) cwd = cwd.slice(1)
        this.onCwdChange?.(cwd)
      } catch { /* ignore malformed URI */ }
      this.cwdBuffer = ''
    } else {
      // Fallback for CMD and other shells that don't emit OSC 7:
      // detect prompt lines of the form "C:\path>" at the start of a line.
      this.cwdBuffer = (this.cwdBuffer + chunk.replace(ANSI_RE, '')).slice(-512)
      const lines = this.cwdBuffer.split(/\r?\n/)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim()
        // Match a bare Windows path prompt: "C:\something>" or Unix "~/path$" style
        const winMatch = /^([A-Za-z]:[^>]*)>$/.exec(line)
        if (winMatch) { this.onCwdChange?.(winMatch[1]); this.cwdBuffer = ''; break }
        const unixMatch = /^([/~][^$#]*)\s*[$#]$/.exec(line)
        if (unixMatch) { this.onCwdChange?.(unixMatch[1].trim()); this.cwdBuffer = ''; break }
      }
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

  injectOutput(data: string): void {
    this.appendScrollback(data)
    this.fanOut(data)
  }

  write(data: string): void {
    // For direct agent sessions: any Enter press → running (covers first message from idle).
    // For shell sessions: only fire from waiting-input to avoid false spinners on normal commands.
    if (/[\r\n]/.test(data) && (this.isAgentSession || this.agentStatus === 'waiting-input')) {
      this.clearActivityTimers()
      this.setAgentStatus('running')
    }
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
