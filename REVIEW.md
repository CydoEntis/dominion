# Orbit — Comprehensive Code Quality Audit

**Reviewed:** 2026-05-09  
**Scope:** All source files under `src/`  
**Method:** Full file-by-file read with cross-file analysis

---

## Executive Summary

The codebase is in reasonably good shape architecturally — IPC is properly abstracted through services, the store slices are well-structured, and hooks correctly own side effects. However, there are several categories of significant problems:

**Worst offenders:**

1. **Massive duplication of the "Edit Session" modal** — the same ~80-line component is copy-pasted verbatim into `SessionTab.tsx`, `SessionDashboard.tsx`, and `AgentMonitorSidebar.tsx`. All three implement the identical name/color editor with the same validation logic.

2. **`AgentMonitorSidebar.tsx` is a 926-line god component** — it contains two full modal components (`EditModal`, `GroupEditModal`) inline, a `SessionRow` sub-component, complex drag-and-drop state, group management, note tree state, sidebar resize logic, and all their event handlers. This is the single most egregious file.

3. **`SessionDashboard.tsx` is 1004 lines** — a second enormous file containing yet more duplicated modal implementations (`CreateGroupModal`, `EditGroupModal`), a `GroupCtxMenu`, a `SessionGroupMenu`, inline async IPC calls in event handlers, and a `ProjectSection` sub-component. This file should not exist in its current form.

4. **Direct `window.ipc.invoke()` calls in components** — `SettingsForm` and `NewSessionForm` bypass the service layer and call `window.ipc.invoke()` directly for folder/file picking, violating the architectural boundary that all IPC calls should go through `*.service.ts` files.

5. **Duplicated path normalization** — `replace(/\\/g, '/')` is written inline at least 15 times across 6+ files. There is no shared utility for this.

6. **`useTerminal.ts` is 535 lines** doing too many things at once** — terminal setup, IPC data subscription, diff patch capture, context menu, search, clipboard handling, resize observation, and visibility tracking all in one hook.

7. **`App.tsx` contains business logic** — theme application, workspace session filtering with path normalization, sidebar drag state, and IPC listener setup for `WINDOW_INITIAL_NOTE_PREVIEW` all live directly in the component rather than in hooks.

8. **`ShellSelect` in `SettingsForm.tsx` calls `window.ipc.invoke()` directly** — an IPC call inside a component, bypassing `fs.service.ts` which already has shell detection factored out.

**Overall assessment:** The vertical-slice folder structure is sound, the IPC bridge and service layer pattern is well-designed, and the store is cleanly composed. The problems are concentrated in a handful of large files that were grown organically without extraction discipline. Fixing the duplicated modal components and the two god-component files would eliminate the majority of the quality debt.

---

## CRITICAL

### CR-01: Silent error swallowing hides data-loss failures during layout restore

**File:** `src/renderer/features/session/hooks/useLayoutRestore.ts:70`

```typescript
      } catch {}
```

The `createSession` call inside the restore loop is wrapped in an empty `catch`. If session creation fails (network/PTY error), the failure is silently swallowed, `idMap` is not populated for that session, and the layout tree restore for that tab is skipped with no user notification. This means after app restart the user can silently lose part of their persisted layout with no indication of what happened.

**Fix:** At minimum log the error and show a toast:
```typescript
} catch (err) {
  console.error('Failed to restore session:', ps.name, err)
  toast.error(`Could not restore "${ps.name}"`)
}
```

---

### CR-02: `patchSession` on main process uses `as any` to bypass type safety

**File:** `src/main/features/session/session-service.ts:138`

```typescript
export function patchSession(sessionId: string, patch: { name?: string; color?: string; groupId?: string; taskStatus?: string }): SessionMeta | undefined {
  const updated = updateSessionMeta(sessionId, patch as any)
```

And in `session-ipc.ts:43`:
```typescript
    return patchSession(payload.sessionId, patch as any)
```

The `patch` object accepts `worktreePath`, `worktreeBranch`, `worktreeBaseBranch`, and `projectRoot` at the IPC layer (session-ipc.ts lines 38-42) but the `patchSession` function signature does not declare these fields — they are smuggled through `as any`. If `updateSessionMeta` ever narrows the type it accepts, this will break silently at runtime.

**Fix:** Add the missing fields to the `patchSession` signature and remove the `as any` cast:
```typescript
export function patchSession(
  sessionId: string,
  patch: Partial<Pick<SessionMeta, 'name' | 'color' | 'groupId' | 'taskStatus' | 'worktreePath' | 'worktreeBranch' | 'worktreeBaseBranch' | 'projectRoot'>>
): SessionMeta | undefined {
  const updated = updateSessionMeta(sessionId, patch)
```

---

### CR-03: IPC call directly in component — `NewSessionForm` calls `window.ipc.invoke`

**File:** `src/renderer/features/session/components/NewSessionForm.tsx:113`

```typescript
const pickDir = async (): Promise<void> => {
  const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null
  if (picked !== null) setSelectedDir(picked)
}
```

`window.service.ts` already exports `pickFolder()`. This direct invocation bypasses the service layer, uses a type assertion, and duplicates the service call.

**Fix:** Import and call `pickFolder` from the window service:
```typescript
import { pickFolder } from '../../window/window.service'

const pickDir = async (): Promise<void> => {
  const picked = await pickFolder()
  if (picked !== null) setSelectedDir(picked)
}
```

---

### CR-04: `SettingsForm` calls `window.ipc.invoke` directly four times

**File:** `src/renderer/features/settings/components/SettingsForm.tsx:151-178` and `ShellSelect` at line 89

The six `pick*` async functions each directly call `window.ipc.invoke(IPC.DIALOG_PICK_FOLDER)` or `IPC.DIALOG_PICK_FILE`. The `ShellSelect` sub-component calls `window.ipc.invoke(IPC.FS_DETECT_SHELLS)` directly (line 89), which bypasses `fs.service.ts` where a `detectShells` function should live.

**Fix:** Add `detectShells` and `pickFile` to the appropriate services and use them:
```typescript
// fs.service.ts
export async function detectShells(): Promise<{ name: string; path: string }[]> {
  return ipc.invoke(IPC.FS_DETECT_SHELLS) as Promise<{ name: string; path: string }[]>
}

// window.service.ts
export async function pickFile(): Promise<string | null> {
  return ipc.invoke(IPC.DIALOG_PICK_FILE) as Promise<string | null>
}
```

---

## HIGH

### H-01: Duplicated "Edit Session" modal — three near-identical implementations

The same edit session modal (name input + character counter + color picker + save/cancel) is implemented three times:

- `src/renderer/features/session/components/SessionTab.tsx:24-124` — `EditModal`
- `src/renderer/features/session/components/AgentMonitorSidebar.tsx:44-102` — `EditModal`
- `src/renderer/features/session/components/SessionDashboard.tsx:544-598` — inline `editOpen` portal inside `SessionRow`

Each has identical structure, identical validation logic (`Name cannot be blank`, `Max 32 characters`), and identical color picker markup. The only minor difference is that `SessionDashboard`'s version also supports a custom color `<input type="color">`, which the other two lack.

**Fix:** Extract a single `EditSessionModal` component into a shared location (e.g., `src/renderer/features/session/components/EditSessionModal.tsx`) and import it everywhere.

---

### H-02: Duplicated "shortPath" helper function — three separate definitions

```
src/renderer/features/workspace/components/AgentMonitorSidebar.tsx:32-36  — shortPath()
src/renderer/features/session/components/SessionDashboard.tsx:421-426       — shortPath()
src/renderer/features/session/hooks/useFileTabs.ts                           — not present (uses inline slice)
```

Both implementations are character-for-character identical:
```typescript
function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 2) return p.replace(/\\/g, '/')
  return `…/${parts.slice(-2).join('/')}`
}
```

**Fix:** Move to `src/renderer/lib/utils.ts` (already the shared utility module) and import from there.

---

### H-03: Duplicated context menu dismiss pattern — four identical listener setups

The same "click outside to dismiss" pattern using `document.addEventListener('mousedown/contextmenu', capture: true)` is copy-pasted into:

- `src/renderer/features/session/components/SessionDashboard.tsx:29-39` — `ProjectContextMenu`
- `src/renderer/features/session/components/SessionDashboard.tsx:109-119` — `SessionGroupMenu`
- `src/renderer/features/session/components/SessionDashboard.tsx:332-342` — `GroupCtxMenu`
- `src/renderer/features/session/components/PaneContextMenu.tsx:47-58`

Each sets up and tears down identical `mousedown` + `contextmenu` listeners in a `useEffect`. This is an extraction candidate for a `useClickOutside(ref, onDismiss)` hook.

---

### H-04: Duplicated "Create group / Edit group" modal — two implementations

- `src/renderer/features/session/components/SessionDashboard.tsx:190-259` — `CreateGroupModal`
- `src/renderer/features/session/components/SessionDashboard.tsx:263-320` — `EditGroupModal`
- `src/renderer/features/workspace/components/AgentMonitorSidebar.tsx:110-171` — `GroupEditModal`

`AgentMonitorSidebar.GroupEditModal` and `SessionDashboard.EditGroupModal` are near-identical: same structure, same color picker, same name input, same save/cancel pattern. `CreateGroupModal` differs only in that it includes a custom color `<input type="color">` swatch.

**Fix:** Extract a single `GroupModal` component that accepts `mode: 'create' | 'edit'`.

---

### H-05: Business logic and side effects in `App.tsx` — architecture violation

**File:** `src/renderer/App.tsx:186-310`

`App.tsx` contains:

1. **Lines 186-190**: A `useEffect` that listens to `document.addEventListener('acc:toggle-git-review', ...)` — this is event-bus handling that belongs in a hook.
2. **Lines 194-210**: A `useEffect` computing workspace session membership with path normalization (`replace(/\\/g, '/')`) — derived state computation with business logic.
3. **Lines 219-232**: Inline sidebar drag state management (`sidebarDragRef`, `handleSidebarDragStart`) with `document.addEventListener` — should be a `useSidebarResize` hook.
4. **Lines 235-250**: Theme application logic with media query listener — should be a `useTheme` hook (pattern already used for `useWindowMaximized`).
5. **Lines 278-311**: `useEffect` chains for note focus tracking, `acc:note-active-changed` event listening, and title bar string composition — all business/derived-state logic.
6. **Lines 278-283**: Direct `ipc.on(IPC.WINDOW_INITIAL_NOTE_PREVIEW, ...)` call inside the component.

**Fix:** Extract each concern into a focused hook. At minimum:
- `useTheme(appTheme)` — theme application
- `useSidebarResize(initialWidth)` — sidebar drag logic
- `useNoteWindowPreview()` — IPC listener for `WINDOW_INITIAL_NOTE_PREVIEW`
- `useWorkspaceSession(storeActiveSessionId, workspaceProject)` — the active session/workspace mapping logic

---

### H-06: `AgentMonitorSidebar.tsx` is a 926-line god component

**File:** `src/renderer/features/workspace/components/AgentMonitorSidebar.tsx`

Contains:
- Two full modal components (lines 44-171)
- A complete `SessionRow` sub-component (lines 187-245)  
- 28 `useState` declarations across the main component
- Sidebar resize drag logic (lines 346-361) that mirrors `App.tsx`'s sidebar drag
- Note panel activation logic (lines 363-400)
- Group management handlers (async IPC calls via `patchSession`, `updateSettings`)
- Drop zone handlers with `onDragOver`/`onDragLeave`/`onDrop`
- Complex group rendering inline (lines 551-616)

The component does too many distinct things. The group CRUD logic alone would benefit from being in a `useGroupManagement` hook.

---

### H-07: `SessionDashboard.tsx` is a 1004-line god component that is largely dead in the active UI

**File:** `src/renderer/features/session/components/SessionDashboard.tsx`

This is a large component containing a full alternative session management UI. A search of where it is imported reveals it is referenced in `SessionTab.tsx` (for `FileTree`) but `SessionDashboard` itself does not appear to be mounted in the current `App.tsx` or any active layout path. It appears to be a legacy component that was replaced by `AgentMonitorSidebar` but not removed.

If `SessionDashboard` is truly unused in the active app, it is significant dead code. If it is still active in some code path not captured in this review, its size and the level of duplication it shares with `AgentMonitorSidebar` still warrants aggressive refactoring.

**Recommendation:** Verify if `SessionDashboard` is reachable in the running app. If not, delete it. If it is, the `EditModal`, `EditGroupModal`, `CreateGroupModal`, and `GroupCtxMenu` components inside it must be extracted and shared with `AgentMonitorSidebar`.

---

### H-08: Duplicated "remove source tab when moving session" logic — three implementations

In `session.store.ts`, the pattern of "find session in source tab, remove it, clean up tab if empty, then insert into target" appears verbatim in three action implementations:

- `closePane` (lines 103-118) — removes leaf, cleans up tab
- `detachPane` (lines 120-134) — **identical** to `closePane` minus the `delete state.sessions` call
- `insertSessionIntoLayout` (lines 317-342) — same source-removal logic again
- `insertSessionAtRight` (lines 351-379) — same source-removal logic a fourth time

Lines 317-335 and 351-373 are near-identical: both find `sourceTabId`, remove the terminal leaf from the source tree, and clean up the source tab if the tree is empty.

**Fix:** Extract a private `removeSessionFromSourceTab(state, sessionId)` helper function used by all four actions.

---

### H-09: `useTerminal.ts` is a 535-line monolith hook

**File:** `src/renderer/features/terminal/hooks/useTerminal.ts`

This single hook manages:
- Terminal creation and disposal (lines 258-302)
- Clipboard paste handling, custom key handler (lines 309-332)
- IPC data subscription and diff patch capture (lines 348-376)
- Mouse up shift-click for URL/file opening (lines 386-403)
- Right-click context menu (lines 407-432)
- Paste DOM event interception (lines 437-443)
- ResizeObserver and IntersectionObserver (lines 457-476)
- Font update effect (lines 509-518)
- Theme update effect (lines 521-527)

The 11 terminal theme constants at the top (lines 40-178) add another 139 lines.

**Recommended split:**
- Extract theme constants + `resolveTerminalTheme` + `getThemeById` into `terminal-themes.ts`
- Extract the diff capture logic into a focused helper or separate hook `useTerminalDiffCapture`
- The hook itself would shrink to ~200 lines

---

### H-10: Duplicated path normalization — `replace(/\\/g, '/')` inline 15+ times

The same expression is written inline rather than through a utility across:

- `App.tsx:201-202` (×2)
- `AgentMonitorSidebar.tsx:31, 49, 75, 291, 299, 424-426, 653` (×8 minimum)
- `SessionDashboard.tsx:422, 450` (×2)
- `useProjects.ts:31, 49, 51, 74-76, 87` (×5)
- `useLayoutRestore.ts:55`
- `useFilePane.ts:124`
- `session.service.ts` (implicit in payload handling)

**Fix:** Add to `src/renderer/lib/utils.ts`:
```typescript
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}
```

---

### H-11: `NoteDrawer.tsx` exported `FileTree` is imported from wrong location

**File:** `src/renderer/features/workspace/components/AgentMonitorSidebar.tsx:13`

```typescript
import { FileTree } from '../../../components/NoteDrawer'
```

`FileTree` is defined and exported from `NoteDrawer.tsx` — a file named for a different component. `FileTree` has significant complexity of its own (folder management, drag-and-drop, context menus) and should live in its own file (e.g., `features/notes/components/FileTree.tsx`). Importing a feature component from a different feature's UI file is a layering violation.

---

### H-12: Settings store makes IPC calls directly — store/service boundary violation

**File:** `src/renderer/features/settings/settings.store.ts:30-36`

```typescript
loadSettings: async () => {
  const settings = (await ipc.invoke(IPC.SETTINGS_GET)) as AppSettings
  ...
  const notes = (await ipc.invoke(IPC.NOTES_LOAD)) as Note[]
```

The settings store directly imports `ipc` and calls `IPC.*` channels. The pattern for other features is `*.service.ts` files that wrap IPC calls, with stores using state only. `settings.service.ts` already exists and exports `getSettings`/`setSettings` but is not used here.

This mixes transport concerns (IPC) into state management, making the store harder to test and the boundaries less clear. `loadSettings` in the store should call `settings.service.getSettings()` and `notes.service.loadNotes()` rather than directly invoking IPC channels.

---

## MEDIUM

### M-01: `hotkeys.newNote` and `hotkeys.quickNote` are the same key doing the same action

**File:** `src/shared/ipc-types.ts:149-150`

```typescript
newNote: z.string().default('Ctrl+Shift+N'),
quickNote: z.string().default('Ctrl+Shift+N'),
```

Both default to the same keybinding and both trigger the same action (toggle notes / new note). In `useKeyboardShortcuts.ts`, `hk.quickNote` is checked; in `useCommandPalette.ts`, both are referenced in the action descriptions. This is a stale duplicate field in the schema that adds confusion and bloats the settings object.

**Fix:** Remove `newNote` from the schema and the hotkeys UI in `SettingsForm.tsx`.

---

### M-02: `useLayoutRestore` defines `handleRestore` inside the hook body without `useCallback`

**File:** `src/renderer/features/session/hooks/useLayoutRestore.ts:40-99`

`handleRestore` is a plain async function defined in the hook body, then stored in a `handleRestoreRef` and called from a `useEffect`. It captures several store selectors (`setPendingRestore`, `setIsRestoringLayout`, etc.) as closure values. This works because of the ref-updating pattern, but the function is re-created every render. The ref pattern is correct but inconsistently applied — the function should be a `useCallback` with an empty dep array to make the intent clear.

---

### M-03: `GitReviewPanel` ignores the full staged/unstaged structure from `useGitReview`

**File:** `src/renderer/features/workspace/components/GitReviewPanel.tsx:119-121`

```typescript
const allChanges: (GitFileInfo | string)[] = data
  ? [...data.staged, ...data.unstaged, ...data.untracked]
  : []
```

The panel then renders all three categories in a single `Section` titled "Changes", discarding the staged/unstaged distinction that `useGitReview` provides (and that `useGitReview` explicitly fetches staging area state for via `FS_GIT_STAGE`, `FS_GIT_UNSTAGE` actions). The panel does not expose the commit/push functionality from the hook. This means the staging workflow (stage, commit, push) computed in `useGitReview` is completely unused — the hook does extra work for nothing in this path.

---

### M-04: `useFileTabs.ts` duplicates `OpenFile` type already partially defined in `useFilePane.ts`

**File:** `src/renderer/features/session/hooks/useFileTabs.ts:4-8` and `src/renderer/features/fs/hooks/useFilePane.ts:6-10`

```typescript
// useFileTabs.ts
export interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}

// useFilePane.ts (not exported, defined locally)
interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}
```

Identical type, defined twice — once exported and once locally. The local definition in `useFilePane.ts` should import from `useFileTabs.ts` or both should import from a shared types file.

---

### M-05: `useGitReview` starts a 4-second polling interval on every `projectRoot` change

**File:** `src/renderer/features/workspace/hooks/useGitReview.ts:56-60`

```typescript
useEffect(() => {
  if (!projectRoot) return
  const id = setInterval(() => setTick((t) => t + 1), 4000)
  return () => clearInterval(id)
}, [projectRoot])
```

Combined with `useWorktreeStats` which polls every 5 seconds, and `App.tsx` instantiating both simultaneously, there are two concurrent polling loops hitting the main process for git data. If the user has multiple projects or many worktrees, this compounds. Neither interval has any back-off or visibility-based suspension.

---

### M-06: `useConfirmClose` returns JSX from a hook — mixing concerns

**File:** `src/renderer/features/session/hooks/useConfirmClose.tsx`

```typescript
export function useConfirmClose(): {
  requestClose: (onConfirm: () => void) => void
  modal: JSX.Element | null
}
```

This hook renders a modal portal and returns it as a value to be placed in JSX by the caller. This pattern crosses the hook/component boundary: a hook should manage state and return data, not render UI. The returned `modal` is used in five places with `{closeModal}` in JSX.

The standard pattern would be a `ConfirmCloseModal` component that reads from a context or store, or accepting the modal as a component that callers render. Returning JSX from a hook makes the hook non-composable (it owns rendering) and makes testing harder.

---

### M-07: Stale closure risk in `useSessionLifecycle` — ESLint suppression via empty dep array

**File:** `src/renderer/features/session/hooks/useSessionLifecycle.ts:97`

```typescript
  }, [])
```

The main `useEffect` with empty deps captures `upsertSession`, `markSessionExited`, `addTab`, `removePaneBySessionId`, `setWindowId`, `loadSettings`, `setPendingRestore`, and `setIsMainWindow` from the hook body. Because these come from Zustand selectors with stable references, this is technically safe but only because of Zustand's referential stability guarantee — this is a hidden dependency that is not documented. If any selector ever returns an unstable function reference, this will silently break. The `maybeShowRestore` inner function is also a stale closure but references only `layoutRef`, `isMainRef`, `liveSessionsRef`, and `setPendingRestore` — again safe due to ref stability, but not obviously so.

---

### M-08: `handleSplitH` and `handleSplitV` are 90% identical in `usePaneActions`

**File:** `src/renderer/features/session/hooks/usePaneActions.ts:28-45`

```typescript
const handleSplitH = async (): Promise<void> => {
  if (!contextMenu) return
  const { tabId, sessionId } = contextMenu
  const parent = sessions[sessionId]
  const groupId = parent?.groupId ?? tabId
  if (!parent?.groupId) patchSession({ sessionId, groupId }).catch(() => {})
  const newMeta = await createSession({ name: `${parent?.name ?? 'pane'} split`, cwd: parent?.cwd, groupId, cols: 80, rows: 24 })
  splitPane(tabId, sessionId, 'horizontal', newMeta)
}

const handleSplitV = async (): Promise<void> => {
  // ... identical except 'vertical'
}
```

**Fix:**
```typescript
const handleSplit = async (direction: 'horizontal' | 'vertical'): Promise<void> => { ... }
const handleSplitH = () => handleSplit('horizontal')
const handleSplitV = () => handleSplit('vertical')
```

---

### M-09: `DEFAULT_COLOR` constant duplicated across files

- `src/renderer/features/session/components/SessionTab.tsx:15` — `const DEFAULT_COLOR = '#22c55e'`
- `src/renderer/features/session/session.service.ts:6` — first element of `SESSION_COLORS = ['#22c55e', ...]`

The default color is `'#22c55e'` (green) and is referenced as a magic string literal in `SessionTab.tsx` and also implicit in the first element of `SESSION_COLORS`. `SessionTab.tsx` imports `SESSION_COLORS` but then separately defines `DEFAULT_COLOR` instead of using `SESSION_COLORS[0]`.

---

### M-10: `MAX_NAME_LENGTH = 32` is defined in two files

- `src/renderer/features/session/components/SessionTab.tsx:16`
- `src/renderer/features/workspace/components/AgentMonitorSidebar.tsx:29`

Same constant, same value, duplicated. Should live in `session.service.ts` alongside the other session constants.

---

### M-11: Magic number `cols: 80, rows: 24` repeated in 7 locations

The default terminal dimensions `{ cols: 80, rows: 24 }` appear hardcoded in:
- `useLayoutRestore.ts:56`
- `usePaneActions.ts:34, 44`
- `useProjects.ts:63`
- `NewSessionForm.tsx:155, 165, 175`
- `PresetsPanel.tsx:57`
- `SessionDashboard.tsx:947`

`src/shared/constants.ts` already exports `DEFAULT_COLS = 80` and `DEFAULT_ROWS = 24`. None of the above use them.

**Fix:** Import and use `DEFAULT_COLS`/`DEFAULT_ROWS` from `@shared/constants`.

---

### M-12: `removeLayoutLeaf` action expression uses a comma operator side-effect

**File:** `src/renderer/features/session/session.store.ts:293`

```typescript
state.paneTree[tabId] = newTree ?? (tabId === '__root__' ? makeHomeLeaf() : (delete state.paneTree[tabId], undefined!))
```

The `(delete state.paneTree[tabId], undefined!)` idiom uses the comma operator to perform a side-effect (delete) and return `undefined!`. This is clever but fragile — the `!` non-null assertion on `undefined` is intentional type coercion that silences TypeScript. An if-else block would be clearer and safer.

---

### M-13: `MarkdownPreviewPane` parses markdown on every render

**File:** `src/renderer/features/layout/components/MarkdownPreviewPane.tsx:27`

```typescript
const html = marked.parse(content) as string
```

This is called synchronously during rendering, outside any `useMemo`. Every time the parent re-renders, `marked.parse` is re-executed. For notes with large content this is a performance concern, but more importantly it is a correctness concern — `marked.parse` can return a `Promise` in async mode, and the `as string` cast would silently pass a Promise object to `dangerouslySetInnerHTML`.

**Fix:** Wrap in `useMemo` and ensure sync mode:
```typescript
const html = useMemo(() => marked.parse(content) as string, [content])
```

---

### M-14: `useCommandPalette` rebuilds `items` array on every render

**File:** `src/renderer/features/session/hooks/useCommandPalette.ts:36-60`

`items` is an array constructed inline during every render by filtering `Object.values(sessions)`. This array is then passed to a `useCallback` via closure (`handleKeyDown` depends on `items`), which means both `items` and `handleKeyDown` are recreated on every session state change. Given the command palette is open and keyboard events are live during this time, this could cause missed keys during rapid typing. The items should be `useMemo`-ized.

---

### M-15: `collectSessionIds` in context menu check uses stale `||` fallback

**File:** `src/renderer/features/workspace/components/AgentMonitorSidebar.tsx:785`

```typescript
!collectSessionIds(paneTree[activeSessionId] ?? { type: 'leaf', sessionId: '' }).includes(ctxMenu.meta.sessionId)
```

The fallback `{ type: 'leaf', sessionId: '' }` is not a valid `LayoutNode` (it's missing `id` and `panel`). TypeScript accepts it because the shape of the type union happens to be compatible at this point, but passing a structurally-invalid fallback to `collectSessionIds` is fragile. Use an early return or optional chaining instead.

---

### M-16: `GroupColors` constant duplicated in `AgentMonitorSidebar` vs `SessionDashboard`

- `AgentMonitorSidebar.tsx:30` — `const GROUP_COLORS = ['#6366f1', '#8b5cf6', ...]` (8 colors)
- `SessionDashboard.tsx:21` — `const GROUP_COLORS = SESSION_COLORS` (aliased to session colors, 10 colors)

These produce different color palettes for what is supposed to be the same concept (group colors). The inconsistency means a group created in one context can display differently in the other.

---

## LOW

### L-01: `console.error` left in production code

**File:** `src/renderer/features/session/components/NewSessionForm.tsx:195`

```typescript
console.error('Failed to create session:', err)
```

This is the only `console.error` call in the renderer. It should be removed or replaced with a logging utility — the `toast.error` on the next line already surfaces the error to the user.

---

### L-02: `isDashboardOpen` in `WindowSlice` appears unused

**File:** `src/renderer/features/window/window.store.ts:7, 27-29`

`isDashboardOpen` and `toggleDashboard` are defined in the window slice but a search of the renderer source does not find any component reading `isDashboard Open` from the store. This may be dead state from a refactor.

---

### L-03: `settings.service.ts` is bypassed everywhere — effectively dead

**File:** `src/renderer/features/settings/settings.service.ts`

This file exports `getSettings` and `setSettings`, but:
- The settings store (`settings.store.ts`) calls `ipc.invoke` directly
- `SettingsForm.tsx` calls `window.ipc.invoke` directly
- No file in the renderer imports from `settings.service.ts`

The service file exists but is never used. Either the store should use it, or the file should be deleted.

---

### L-04: Unused `insertAtLeft` export in `layout-tree.ts`

**File:** `src/renderer/features/layout/layout-tree.ts:60-68`

`insertAtLeft` is exported but a search of the codebase finds no import of it. All sidebar-click insertions use `insertAtRight` or `insertSessionAtRight`. This function appears to be dead code.

---

### L-05: `TERMINAL_THEME_LIST` does not include `'space'`, `'nebula'`, `'solar'`, `'aurora'` themes

**File:** `src/renderer/features/terminal/hooks/useTerminal.ts:180-186`

The four app-level themes (`space`, `nebula`, `solar`, `aurora`) have dedicated terminal themes (`SPACE_TERMINAL_THEME` etc.) but they are not in `TERMINAL_THEME_LIST` and therefore not selectable via the `StatusTerminalThemeToggle` in `App.tsx`. They are only applied automatically when the app theme is set. This appears intentional (they are auto-applied, not user-selectable terminal overrides) but it is not documented, and the `NAMED_THEMES` registry (which only contains the five selectable themes) vs. the four auto-applied themes creates a split that is confusing to read.

---

### L-06: `IPC.WINDOW_OPEN_SETTINGS` is defined in channels but never handled

**File:** `src/shared/ipc-channels.ts:24`

```typescript
WINDOW_OPEN_SETTINGS: 'window:open-settings',
```

A search of the main process IPC handlers does not find a handler for this channel. It may be a planned feature or dead code from a removed feature.

---

### L-07: `PresetsPanel` — `InlineForm` is a component defined inside another component

**File:** `src/renderer/features/settings/components/PresetsPanel.tsx:101-144`

`InlineForm` is defined as a function inside `PresetsPanel`. React will recreate the component definition on every render of `PresetsPanel`, causing remounts and loss of focus state in the form. It should be hoisted to the module level.

---

### L-08: `useFileTabs.ts` — `handleCloseFile` reads potentially stale `openFiles` in closure

**File:** `src/renderer/features/session/hooks/useFileTabs.ts:65-72`

```typescript
const handleCloseFile = (path: string): void => {
  setOpenFiles((prev) => prev.filter((f) => f.path !== path))
  setActiveFilePath((cur) => {
    if (cur !== path) return cur
    const remaining = openFiles.filter((f) => f.path !== path)  // <-- stale closure!
    return remaining.length > 0 ? remaining[remaining.length - 1].path : null
  })
}
```

`openFiles` in the `setActiveFilePath` updater is the value from the last render, not the post-`setOpenFiles` value. The correct pattern is to use the functional updater form of `setOpenFiles` and compute active path inside it, or to derive it from `prev` in the updater.

**Fix:**
```typescript
const handleCloseFile = (path: string): void => {
  setOpenFiles((prev) => {
    const remaining = prev.filter((f) => f.path !== path)
    setActiveFilePath((cur) => cur !== path ? cur : remaining.at(-1)?.path ?? null)
    return remaining
  })
}
```

---

### L-09: `useLayoutPersistence` save timer is not flushed synchronously on settings-change triggered unmount

**File:** `src/renderer/features/session/hooks/useLayoutPersistence.ts:59-63`

The `saveLayout` call is debounced with a 2-second timer. If the renderer unmounts (e.g., app quit) during the debounce window, the timer cleanup in the `useEffect` return clears the timer without flushing. This means layout changes made within 2 seconds of app close are silently lost. A `beforeunload` handler or a synchronous flush on `unload` would be needed to guarantee persistence on quit.

---

### L-10: `makeId()` in `layout-tree.ts` uses `Math.random()` — not cryptographically random

**File:** `src/renderer/features/layout/layout-tree.ts:1-3`

```typescript
function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}
```

These IDs are used as React keys and layout node identifiers. `Math.random` produces 48 bits of entropy, giving an 8-character base-36 string (~41 bits after slicing). Collision probability is low in practice (at most ~20 panes at once) but `crypto.randomUUID()` is available and already used elsewhere in the codebase. This is low priority but inconsistent.

---

## Duplication Inventory

| # | What | Location A | Location B | Location C |
|---|------|-----------|-----------|-----------|
| 1 | `EditModal` (Edit Session modal) | `SessionTab.tsx:24-124` | `AgentMonitorSidebar.tsx:44-102` | `SessionDashboard.tsx:540-598` (inline) |
| 2 | `EditGroupModal`/`GroupEditModal` | `SessionDashboard.tsx:263-320` | `AgentMonitorSidebar.tsx:110-171` | — |
| 3 | `shortPath()` function | `AgentMonitorSidebar.tsx:32-36` | `SessionDashboard.tsx:421-426` | — |
| 4 | Click-outside dismiss `useEffect` | `SessionDashboard.tsx:29-39` | `SessionDashboard.tsx:109-119` | `SessionDashboard.tsx:332-342`, `PaneContextMenu.tsx:47-58` |
| 5 | `replace(/\\/g, '/')` inline normalization | `App.tsx:201-202` | `AgentMonitorSidebar.tsx:×8` | `useProjects.ts:×5`, `SessionDashboard.tsx:×2` |
| 6 | `cols: 80, rows: 24` magic numbers | `useLayoutRestore.ts:56` | `usePaneActions.ts:34,44` | `useProjects.ts:63`, `NewSessionForm.tsx:×3`, `PresetsPanel.tsx:57`, `SessionDashboard.tsx:947` |
| 7 | `MAX_NAME_LENGTH = 32` constant | `SessionTab.tsx:16` | `AgentMonitorSidebar.tsx:29` | — |
| 8 | `GROUP_COLORS` constant | `AgentMonitorSidebar.tsx:30` | `SessionDashboard.tsx:21` (different palette!) | — |
| 9 | `DEFAULT_COLOR = '#22c55e'` | `SessionTab.tsx:15` | `SESSION_COLORS[0]` in `session.service.ts` | — |
| 10 | Source-tab removal logic in store actions | `closePane:103-118` | `detachPane:120-134` | `insertSessionIntoLayout:317-335`, `insertSessionAtRight:353-373` |
| 11 | `handleSplitH` / `handleSplitV` body | `usePaneActions.ts:28-35` | `usePaneActions.ts:37-44` | — |
| 12 | `OpenFile` type definition | `useFileTabs.ts:4-8` | `useFilePane.ts:6-10` | — |
| 13 | `getGitDiff` called from panel component | `GitReviewPanel.tsx:43` | `useFilePane.ts` via `fs.service` | — |
| 14 | Theme-aware `isDark` computation | `App.tsx:239` | `useTerminal.ts:193` | `EmptyState.tsx:12` |

---

## Recommendations — Prioritized

**Do first (highest impact / lowest risk):**
1. Extract `EditSessionModal` into a shared component — eliminates 3 duplicates at once
2. Move `shortPath`, `normalizePath`, `MAX_NAME_LENGTH`, `DEFAULT_COLOR`, `DEFAULT_COLS/ROWS` to shared modules — purely mechanical, zero logic change
3. Replace `cols: 80, rows: 24` with `DEFAULT_COLS`/`DEFAULT_ROWS` from `@shared/constants` — trivially safe
4. Fix the empty `catch {}` in `useLayoutRestore` to surface errors
5. Fix `handleCloseFile` stale closure bug in `useFileTabs`

**Do second (architectural cleanup):**
6. Remove IPC calls from `NewSessionForm` and `SettingsForm` — route through service functions
7. Extract theme logic and sidebar resize from `App.tsx` into hooks
8. Extract `useClickOutside` hook to replace the 4 duplicated dismiss effects
9. Add `detectShells` to `fs.service.ts`, `pickFile` to `window.service.ts` — complete the service layer
10. Use `settings.service.ts` from the settings store (or delete the service file)

**Do third (size reduction):**
11. Extract terminal theme constants from `useTerminal.ts` into `terminal-themes.ts`
12. Extract source-tab removal pattern in session store into a shared helper
13. Audit `SessionDashboard` — determine if it is dead code and delete or migrate

---

_Reviewed: 2026-05-09_  
_Reviewer: Claude (manual audit, full file read)_
