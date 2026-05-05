# Dominion — Feature Roadmap

---

## Bugs

- [ ] **Detached window session recovery** — when a detached window is closed, the session tab in the main window goes gray and can't be resumed. The IPC plumbing (`WINDOW_REATTACH_TAB` in `window-ipc.ts`) already exists — need to detect the detached window's `close` event and either auto-reattach or surface a "Reattach" button on the grayed tab.
- [ ] **Notes save directory** — notes are currently stored as JSON blobs inside `%APPDATA%\Dominion\settings.json` (Electron userData), not as real files. Add a "Notes directory" setting (folder picker) and save each note as an individual `.md` file on disk so users know where their notes live and can point it at a synced folder (e.g. iCloud, Dropbox, OneDrive).

---

## Easy

- [x] **Shell picker in Settings** — let users choose which shell to use (cmd, PowerShell, bash, zsh) instead of always reading from env
- [x] **Session status badge** — show a visual indicator on each session tab when the agent is actively generating vs idle
- [x] **Configurable font size** — expose terminal font size as a settings option
- [x] **Session rename on double-click** — double-click a tab to rename it inline instead of going through the context menu
- [x] **Tab accent color + live indicator recolor** — when a session color is set, the tab bar highlight and the live status indicator circle should both adopt that color, not stay at the default accent
- [x] **Files default to raw view** — open files in raw mode by default instead of whichever view was last active

---

## Medium

- [ ] **Agent message input** — chat-style input bar at the bottom of a terminal pane to send messages to the agent without clicking into the terminal (`> Type a message...`)
- [ ] **Port forwarding panel** — detect and display open ports per session, with one-click browser open (like image #85 bottom-left)
- [ ] **Task status tracking** — tag sessions as IN PROGRESS / READY FOR REVIEW / DONE with color indicators in the sidebar (like image #83)
- [ ] **PR review panel** — pull up a diff view alongside a terminal showing changed files, +/- counts, and approve/comment actions (like image #85 right panel)
- [ ] **Inline git status in file tree** — show +/- line counts next to each changed file in the project file tree
- [x] **File tree state persistence** — file tree should remember which folders are expanded and keep the selected item visible when navigating away to another pane or window and returning
- [x] **Fix terminal pane layout collapse** — terminal pane shrinks/collapses when switching to another pane or window; layout should be preserved across navigation
- [x] **File viewer keybinds** — keyboard shortcuts to switch the active file between raw, markdown preview, and diff views without using the mouse
- [x] **Clickable links and file paths in terminal** — Shift+click a URL in terminal output to open it in the browser; click a file path to open it in the file viewer; Ctrl+C copies selected terminal text; right-click opens a context menu (copy, open link, open file, etc.)

---

## Hard

- [ ] **Git worktree isolation** — each session gets its own isolated git worktree so agents don't step on each other's changes; merge/review when ready (like image #84)
- [ ] **MCP server integration** — detect and display connected MCP servers per session, show connection status in the UI (like image #85)
- [ ] **Workspace management** — group sessions + projects into named workspaces that can be saved, switched, and restored independently
- [ ] **Parallel task orchestration** — spawn N agent sessions from a single task list, track progress across all of them from a unified view (like image #83)
- [ ] **Remote session support** — connect to agents running on a remote machine over SSH instead of only local processes
- [x] **Notes panel** — a lightweight notepad accessible from the sidebar; backed by a user-configured notes directory on the file system; supports creating folders, plain text files, and `.md` files; files are saved directly to disk with no special data model

---

## Ideas / Unsorted

- [ ] Notification when an agent session finishes or hits an error
- [ ] Session output search (Ctrl+F within a terminal pane)
- [ ] Export session transcript to markdown
- [ ] Theme switcher (light mode, custom accent colors)
