export const IPC = {
  // Session: renderer → main (invoke)
  SESSION_CREATE: 'session:create',
  SESSION_KILL: 'session:kill',
  SESSION_LIST: 'session:list',
  SESSION_REPLAY_REQUEST: 'session:replay-request',

  // Session: renderer → main (invoke)
  SESSION_PATCH: 'session:patch',

  // Session: renderer → main (fire-and-forget send)
  SESSION_WRITE: 'session:write',
  SESSION_RESIZE: 'session:resize',

  // Session: main → renderer (push)
  SESSION_DATA: 'session:data',
  SESSION_EXIT: 'session:exit',
  SESSION_META_UPDATE: 'session:meta-update',

  // Window: renderer → main (invoke)
  WINDOW_GET_ID: 'window:get-id',
  WINDOW_DETACH_TAB: 'window:detach-tab',
  WINDOW_CONTROL: 'window:control',
  WINDOW_OPEN_SETTINGS: 'window:open-settings',

  WINDOW_REATTACH_TAB: 'window:reattach-tab',

  // Window: main → renderer (push)
  WINDOW_INITIAL_SESSIONS: 'window:initial-sessions',
  WINDOW_TAB_REATTACHED: 'window:tab-reattached',
  WINDOW_MAXIMIZED_CHANGE: 'window:maximized-change',

  // Settings: renderer → main (invoke)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Dialog: renderer → main (invoke)
  DIALOG_PICK_FOLDER: 'dialog:pick-folder',
  DIALOG_PICK_FILE: 'dialog:pick-file',

  // Persistence: renderer → main (invoke)
  PERSISTENCE_SAVE: 'persistence:save',
  PERSISTENCE_LOAD: 'persistence:load',
  PERSISTENCE_CLEAR: 'persistence:clear',

  // Updater: main → renderer (push)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  // Updater: renderer → main (invoke)
  UPDATE_INSTALL: 'update:install',

  // Filesystem: renderer → main (invoke)
  FS_DETECT_SHELLS: 'fs:detect-shells',
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_GIT_STATUS: 'fs:git-status',
  FS_GIT_DIFF_FILE: 'fs:git-diff-file',
  FS_SHOW_IN_FOLDER: 'fs:show-in-folder',
  FS_OPEN_PATH: 'fs:open-path',
  FS_OPEN_IN_EDITOR: 'fs:open-in-editor',
  FS_DETECT_EDITORS: 'fs:detect-editors',
  FS_RENAME: 'fs:rename',
  FS_TRASH: 'fs:trash',
  FS_FIND_FILES: 'fs:find-files',

  // Git review: renderer → main (invoke)
  FS_GIT_REVIEW: 'fs:git-review',
  FS_GIT_STAGE: 'fs:git-stage',
  FS_GIT_STAGE_ALL: 'fs:git-stage-all',
  FS_GIT_UNSTAGE: 'fs:git-unstage',
  FS_GIT_UNSTAGE_ALL: 'fs:git-unstage-all',
  FS_GIT_COMMIT: 'fs:git-commit',
  FS_GIT_PUSH: 'fs:git-push',
  FS_GIT_BRANCH_INFO: 'fs:git-branch-info',
  FS_GIT_LOG: 'fs:git-log',

  // Git worktrees: renderer → main (invoke)
  FS_GIT_WORKTREE_CREATE: 'fs:git-worktree-create',
  FS_GIT_WORKTREE_REMOVE: 'fs:git-worktree-remove',
  FS_GIT_WORKTREE_STATS: 'fs:git-worktree-stats',

  // Notes: renderer → main (invoke)
  NOTES_LOAD: 'notes:load',
  NOTES_SAVE: 'notes:save',
  NOTES_DELETE: 'notes:delete',

  // Shell: renderer → main (invoke)
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Clipboard: renderer → main (invoke)
  CLIPBOARD_READ_TEXT: 'clipboard:read-text'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
