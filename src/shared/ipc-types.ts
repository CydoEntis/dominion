import { z } from 'zod'

// ─── Session ────────────────────────────────────────────────────────────────

export const CreateSessionPayloadSchema = z.object({
  name: z.string().min(1).max(64),
  agentCommand: z.string().optional(), // e.g. 'claude', 'codex', 'gemini'; omit for plain shell
  cwd: z.string().optional(),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
  color: z.string().optional(),
  groupId: z.string().optional(),
  yoloMode: z.boolean().optional(),
  worktreePath: z.string().optional(),
  worktreeBranch: z.string().optional(),
  worktreeBaseBranch: z.string().optional(),
  projectRoot: z.string().optional()
})
export type CreateSessionPayload = z.infer<typeof CreateSessionPayloadSchema>

export const SessionStatusSchema = z.enum(['running', 'exited', 'killed'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

export const AgentStatusSchema = z.enum(['idle', 'running', 'waiting-input'])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const TaskStatusSchema = z.enum(['in-progress', 'review', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const SessionMetaSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string(),
  agentCommand: z.string().optional(),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  status: SessionStatusSchema,
  exitCode: z.number().nullable(),
  createdAt: z.number(),
  pid: z.number().nullable(),
  color: z.string().optional(),
  agentStatus: AgentStatusSchema.default('idle'),
  conversationId: z.string().optional(),
  groupId: z.string().optional(),
  taskStatus: TaskStatusSchema.optional(),
  yoloMode: z.boolean().optional(),
  worktreePath: z.string().optional(),
  worktreeBranch: z.string().optional(),
  worktreeBaseBranch: z.string().optional(),
  projectRoot: z.string().optional(),
})
export type SessionMeta = z.infer<typeof SessionMetaSchema>

export const SessionWritePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  data: z.string()
})
export type SessionWritePayload = z.infer<typeof SessionWritePayloadSchema>

export const SessionResizePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})
export type SessionResizePayload = z.infer<typeof SessionResizePayloadSchema>

export const SessionReplayRequestSchema = z.object({
  sessionId: z.string().uuid()
})
export type SessionReplayRequest = z.infer<typeof SessionReplayRequestSchema>

export const SessionReplayResponseSchema = z.object({
  chunks: z.array(z.string())
})
export type SessionReplayResponse = z.infer<typeof SessionReplayResponseSchema>

export const SessionDataPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  data: z.string()
})
export type SessionDataPayload = z.infer<typeof SessionDataPayloadSchema>

export const SessionExitPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  exitCode: z.number()
})
export type SessionExitPayload = z.infer<typeof SessionExitPayloadSchema>

// ─── Window ─────────────────────────────────────────────────────────────────

export const DetachTabPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  fromWindowId: z.string()
})

export const ReattachTabPayloadSchema = z.object({
  sessionId: z.string().uuid()
})
export type ReattachTabPayload = z.infer<typeof ReattachTabPayloadSchema>

export const TabReattachedPayloadSchema = z.object({
  sessionId: z.string().uuid()
})
export type TabReattachedPayload = z.infer<typeof TabReattachedPayloadSchema>
export type DetachTabPayload = z.infer<typeof DetachTabPayloadSchema>

export const DetachTabResponseSchema = z.object({
  newWindowId: z.string()
})
export type DetachTabResponse = z.infer<typeof DetachTabResponseSchema>

export const WindowInitialSessionsPayloadSchema = z.object({
  sessionIds: z.array(z.string().uuid()),
  windowId: z.string()
})
export type WindowInitialSessionsPayload = z.infer<typeof WindowInitialSessionsPayloadSchema>

export const WindowControlActionSchema = z.enum(['minimize', 'maximize', 'close'])
export type WindowControlAction = z.infer<typeof WindowControlActionSchema>

// ─── Settings ───────────────────────────────────────────────────────────────

export const PresetSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(64),
  agentCommand: z.string().optional(),
  cwd: z.string().optional()
})
export type Preset = z.infer<typeof PresetSchema>

export const HotkeysSchema = z.object({
  newSession: z.string().default('Ctrl+T'),
  closeSession: z.string().default('Ctrl+W'),
  commandPalette: z.string().default('Ctrl+P'),
  openProject: z.string().default('Ctrl+O'),
  newNote: z.string().default('Ctrl+N'),
  quickNote: z.string().default('Ctrl+Shift+N'),
  showShortcuts: z.string().default('Ctrl+Shift+K'),
  reviewChanges: z.string().default('Ctrl+Shift+G'),
})
export type Hotkeys = z.infer<typeof HotkeysSchema>

export interface FsEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface GitStatusEntry {
  xy: string
  path: string
}

export const NoteFolderSchema = z.object({ id: z.string(), name: z.string(), color: z.string().optional() })
export type NoteFolder = z.infer<typeof NoteFolderSchema>

export const AppSettingsSchema = z.object({
  projectRoot: z.string().default(''),
  openProjects: z.array(z.string()).default([]),
  recentProjects: z.array(z.string()).default([]),
  defaultShell: z.string().default(''),
  shellStartDir: z.string().default(''),
  sessionGroups: z.array(z.object({ id: z.string(), name: z.string(), color: z.string().optional() })).default([]),
  fontSize: z.number().int().min(8).max(32).default(14),
  fontFamily: z.string().default("'Cascadia Code', 'JetBrains Mono', monospace"),
  theme: z.enum(['system', 'light', 'dark', 'space', 'nebula', 'solar', 'aurora']).default('dark'),
  fileViewerTheme: z.string().default('vitesse-dark'),
  scrollbackLines: z.number().int().min(100).max(100000).default(10000),
  presets: z.array(PresetSchema).default([]),
  hotkeys: HotkeysSchema.default({}),
  confirmCloseSession: z.boolean().default(true),
  resumeOnStartup: z.boolean().default(false),
  dataDirectory: z.string().default(''),
  notesDirectory: z.string().default(''),
  worktreesDirectory: z.string().default(''),
  notes: z.array(z.object({ id: z.string(), content: z.string().default(''), updatedAt: z.number().default(0) })).default([]),
  noteFolders: z.array(NoteFolderSchema).default([]),
  noteFolderMap: z.record(z.string()).default({}),
  lastActiveProject: z.string().default(''),
  defaultSessionDir: z.string().default('')
})

export const NoteSchema = z.object({ id: z.string(), content: z.string().default(''), updatedAt: z.number().default(0) })
export type Note = z.infer<typeof NoteSchema>
export type AppSettings = z.infer<typeof AppSettingsSchema>

export const DEFAULT_SETTINGS: AppSettings = AppSettingsSchema.parse({})

// ─── Persistence ────────────────────────────────────────────────────────────

export interface PersistedSession {
  sessionId: string
  name: string
  agentCommand?: string
  cwd: string
  conversationId?: string
  color?: string
  groupId?: string
  worktreePath?: string
  worktreeBranch?: string
  worktreeBaseBranch?: string
  projectRoot?: string
}

export interface PersistedTab {
  tabId: string
  tree: unknown // PaneNode — typed in renderer
  detached?: boolean
}

export interface PersistedLayout {
  version: 1
  tabs: PersistedTab[]
  activeTabIndex: number
  sessions: PersistedSession[]
}
