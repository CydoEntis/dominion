# Dominion — Feature Roadmap

---

## Easy

- [ ] **Shell picker in Settings** — let users choose which shell to use (cmd, PowerShell, bash, zsh) instead of always reading from env
- [ ] **Session status badge** — show a visual indicator on each session tab when the agent is actively generating vs idle
- [ ] **Configurable font size** — expose terminal font size as a settings option
- [ ] **Session rename on double-click** — double-click a tab to rename it inline instead of going through the context menu

---

## Medium

- [ ] **Agent message input** — chat-style input bar at the bottom of a terminal pane to send messages to the agent without clicking into the terminal (`> Type a message...`)
- [ ] **Port forwarding panel** — detect and display open ports per session, with one-click browser open (like image #85 bottom-left)
- [ ] **Task status tracking** — tag sessions as IN PROGRESS / READY FOR REVIEW / DONE with color indicators in the sidebar (like image #83)
- [ ] **PR review panel** — pull up a diff view alongside a terminal showing changed files, +/- counts, and approve/comment actions (like image #85 right panel)
- [ ] **Inline git status in file tree** — show +/- line counts next to each changed file in the project file tree

---

## Hard

- [ ] **Git worktree isolation** — each session gets its own isolated git worktree so agents don't step on each other's changes; merge/review when ready (like image #84)
- [ ] **MCP server integration** — detect and display connected MCP servers per session, show connection status in the UI (like image #85)
- [ ] **Workspace management** — group sessions + projects into named workspaces that can be saved, switched, and restored independently
- [ ] **Parallel task orchestration** — spawn N agent sessions from a single task list, track progress across all of them from a unified view (like image #83)
- [ ] **Remote session support** — connect to agents running on a remote machine over SSH instead of only local processes

---

## Ideas / Unsorted

- [ ] Notification when an agent session finishes or hits an error
- [ ] Session output search (Ctrl+F within a terminal pane)
- [ ] Export session transcript to markdown
- [ ] Theme switcher (light mode, custom accent colors)
