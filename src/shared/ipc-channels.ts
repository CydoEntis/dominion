export const IPC = {
  // Session: renderer → main (invoke)
  SESSION_CREATE: 'session:create',
  SESSION_KILL: 'session:kill',
  SESSION_LIST: 'session:list',
  SESSION_REPLAY_REQUEST: 'session:replay-request',

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

  // Persistence: renderer → main (invoke)
  PERSISTENCE_SAVE: 'persistence:save',
  PERSISTENCE_LOAD: 'persistence:load',
  PERSISTENCE_CLEAR: 'persistence:clear',

  // Filesystem: renderer → main (invoke)
  FS_READ_DIR: 'fs:read-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_GIT_STATUS: 'fs:git-status',
  FS_GIT_DIFF_FILE: 'fs:git-diff-file'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
