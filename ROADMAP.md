# Orbit — Roadmap

---

## Up Next

| Priority | Item | Notes |
|----------|------|-------|
| High | Workspace management | Group sessions + projects into named workspaces; save, switch, restore |
| High | PR review panel | Diff view alongside terminal — changed files, +/- counts, approve/comment |
| Medium | Inline git status in file tree | Show +/- line counts next to changed files in project file tree |
| Medium | Remote session support | Connect to agents on remote machines over SSH |
| Medium | Terminal grid view | Small live previews of all running terminals in a grid — explore feasibility |
| Medium | Better diff views | Side-by-side diff with clear add/remove/change highlighting |
| Low | Docker sandbox sessions | Isolate agent sessions in containers |

---

## Bug Backlog

### Easy
| Bug | Notes |
|-----|-------|
| Cannot close note tabs via X inside the tab | Missing close handler on note tab UI |
| Right-clicking a session tab should open a context menu with Close | Add right-click handler to session tabs |
| Right-click paste still inserts content twice | Duplicate paste event — likely mousedown + contextmenu both firing |
| Need physical buttons for all keyboard shortcuts | Toolbar/button equivalents for keyboard-illiterate users |

### Medium
| Bug | Notes |
|-----|-------|
| Copy/paste (Ctrl+C / Ctrl+V) not working in notes | Clipboard events being swallowed by editor or terminal focus |
| Shift+Enter should insert a newline, not send message | Input keydown handler needs to intercept Shift+Enter before submit |
| Session tabs don't update working directory path on `cd` | Need to track cwd changes from shell output (OSC 7 or prompt hook) |
| Split terminals should inherit the cwd of the parent terminal | Pass parent cwd when spawning a split session |
| Close all sessions / close all above or below focused session | Add bulk-close options to session tab context menu |
| Split terminals and parent should auto-group together | Create/assign a group automatically when a split is created |

### Hard
| Bug | Notes |
|-----|-------|
| Untitled notes mass-created on new note or panel reopen | State management bug — note creation firing multiple times |
| Notes not saving to disk | Persist layer broken or missing; may need full note system rethink |
| Terminal renders garbled characters on vertical scroll | xterm.js rendering artifact — investigate scroll buffer / renderer settings |
| Terminal color schemes missing on macOS | Platform-specific theme gap; needs investigation on Mac build |
| Auto-update broken on new release / patch | Electron updater misconfigured or signature mismatch; needs full debug pass |
| Terminal theme selector (like file viewer) | New feature — add per-session color scheme picker similar to file viewer |
| Session spinner / activity indicator | Research OSC title-change detection or Claude Code hook for reliable signal |
| Orbit mobile management | Research-only — assess feasibility of phone-based session control |

---

## On Hold

| Item | Reason |
|------|--------|
| Agent status indicators (spinner / pulse / idle dot) | PTY stream gives no reliable "done" signal — `\r*\r` spinner pattern works but extended thinking has >8s silent gaps that break timer-based detection. Need OSC title change detection or a proper Claude Code hook. Disabled in v0.2.1. |
| Agent session notifications (finished / waiting for input toasts) | Depends on reliable agent status detection above. Disabled in v0.2.1. |
| Agent message input bar | Not sure what's needed here |
| Port forwarding panel | Not sure what's needed here |
| Detached window isolation | Deferred |
| Git worktree isolation per session | Deferred |
| MCP server integration | Deferred |
| Parallel task orchestration | Deferred |
| Notes detach / side-by-side | Deferred |
| Project display redesign | Substantial UX change — needs planning |
| Export session transcript to markdown | Deferred |
| AI chat GUI in terminal | Deferred |

---

## Completed

**Bugs**
- Taskbar icon stale after update/reinstall
- Toast notifications use old theme styling
- Double paste in terminal
- Clicking outside any modal should close it and discard/reset unsaved changes
- Copy/paste loses terminal focus
- Clickable URLs / file paths regression
- Session rename regression
- EmptyState shows hardcoded version
- Detached window close leaves tab gray and unresumable
- Show Shortcuts hotkey not persisting (was stuck on `?` / `Shift+?`)

**UI / Polish**
- Session group headers: gradient background + Layers icon
- Session groups: edit modal (rename + color picker) on double-click
- Session groups: right-click context menu (open all in splits, edit, delete)
- Session groups: collapse / expand all buttons
- Projects tab: collapse / expand all buttons
- Projects tab: search / filter bar
- Notes folders: collapse / expand all buttons
- Notes: indentation + left-border for notes inside folders
- Note folder headers: gradient style matching project sections
- Theme picker moved to activity bar (between Presets and Settings)
- Theme picker opens a menu with Dark / Light / System options
- Light mode: proper white UI with dark text
- Terminal respects light/dark theme (live-updates on switch)

**Features**
- Notes raw / preview toggle (Alt+R / Alt+P)
- Note task-list checkboxes (click to toggle in preview)
- Notes: Ctrl+Shift+N reopens existing note instead of creating new
- Notes: color-coded tabs with gradient accent
- Notes: folder / category organization with drag-and-drop
- Projects pane: collapse all except last-active
- Right-click session: Detach option
- Hotkey for Show Shortcuts changed to Ctrl+Shift+K (rebindable in Settings)
- Terminal linked to project on open (auto-cd + visual indicator)
- Session creation: assign to or create group inline
- Custom / expanded session colors with full color picker
- Terminal scrollbar mouse support
- Task status tracking (IN PROGRESS / REVIEW / DONE tags)
- Open all sessions in a group at once in split panes
- Per-session YOLO mode (--dangerously-skip-permissions)
- Session output search (Ctrl+F)
- Space theme (dark purple, planned — THEMES array ready in ActivityBar)
