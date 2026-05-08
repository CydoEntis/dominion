# Orbit — Roadmap

---

## Up Next

| Priority | Item | Notes |
|----------|------|-------|
| High | Git commit & push | Blocked on Windows shell quoting bug — `execFile` fix attempted but untested; needs debug pass |
| High | Git staging / unstaging | UI stripped for v0.3.0 beta — stage/unstage individual files and stage-all/unstage-all |
| High | Better diff view | Side-by-side diff with clear add/remove/change highlighting; current inline view is minimal |
| High | Workspace management | Group sessions + projects into named workspaces; save, switch, restore |
| Medium | PR review panel | Full PR review alongside terminal — comments, approve, request changes |
| Medium | Inline git status in file tree | Show +/- line counts next to changed files in project file tree |
| Medium | Remote session support | Connect to agents on remote machines over SSH |
| Medium | Terminal grid view | Small live previews of all running terminals in a grid — explore feasibility |
| Low | Docker sandbox sessions | Isolate agent sessions in containers |

---

## Bug Backlog

### Easy
| Bug | Notes |
|-----|-------|
| Need physical buttons for all keyboard shortcuts | Toolbar/button equivalents for keyboard-illiterate users |

### Medium
| Bug | Notes |
|-----|-------|
| Shift+Enter should insert a newline, not send message | Requires agent message input bar (On Hold) — nothing to intercept yet |
| Session tabs don't update working directory path on `cd` | OSC 7 + shell integration injection is in place for bash/zsh/fish/pwsh. CMD has a prompt-parsing fallback but it's fragile with custom prompts. Best long-term fix: rely on Claude Code / Codex emitting OSC 7 when agent takes over, which covers the most important case. |

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
- Right-click session tab context menu with Close (was already implemented in SessionTabBar)
- Right-click paste double-insert — contextmenu listener moved to capture phase; xterm.js no longer sees the event
- Note deletion / folder deletion leaving NoteEditor blank — stale openNoteIds cleaned via sync effect; visible falls back to full sorted list when filter returns empty
- Note tab X closes tab without deleting (openNoteIds set tracks open tabs; NotepadPane delete is separate)

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

**v0.3.0**
- Agent monitor sidebar — session list, project context, task status in one panel
- Git diff viewer — status bar badge + panel with clickable inline diffs (read-only)
- Side panel overlay system — Git, Notes, Settings open as overlays over the workspace
- Settings: hotkey rebinding, shell auto-detection picker, notes/session dir pickers, resume on startup, confirm close toggle
- Space theme (dark purple/indigo); terminal and UI live-update on theme switch
- ORBIT empty state screen with keyboard shortcut reference when no session is active
- Shell integration: OSC 7 directory tracking for bash, zsh, fish, PowerShell

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
