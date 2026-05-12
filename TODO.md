# TODO

## Git Integration + Workspace Rework

Make every session workspace-aware and add first-class git account integration.

**Goals:**
- Users can connect GitHub/GitLab accounts directly in Orbit (OAuth or PAT)
- Clone a repo into the app from the new session / new orchestrator flow — no terminal bootstrapping required
- Every session has a workspace tier: git-backed (cloned or existing repo), folder-backed (arbitrary directory), or ephemeral (no cwd, quick tasks)
- Fix existing git UX issues (worktree stats, branch display, stale git state)

**Why deferred:** Requires reworking the session creation modal, sidebar workspace concept, and adding an auth/credentials store. Scope is significant. Prioritize after core agent features are stable.

---

## Detach Notes Pane
Allow notes panes to be detached into their own window, the same way terminal sessions can be detached.
Currently only terminal sessions support "Detach to Window" — notes should have the same option from the pane context menu.

## Detached Window Layout
When a session or note is detached, the window that opens should show only the layout panel — no sidebar.
- No workspace/session sidebar
- No notes list
- Full-width layout with drag-and-drop still functional (can drop sessions/notes into the layout from the main window)
- Reattach option still available from the pane context menu
