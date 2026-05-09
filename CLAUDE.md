# Orbit — Claude Code Guide

Orbit is a multi-session terminal manager for AI coding agents. Built with Electron + React + TypeScript.

## Dev commands

```bash
npm run dev          # start with hot-reload (electron-vite)
npm run build        # production build
npm run typecheck    # tsc across all tsconfigs (no emit)
npm run lint         # eslint, zero warnings allowed
npm run rebuild      # rebuild node-pty native module after electron version change
```

## Source layout

```
src/
  main/               Electron main process
    index.ts          entry point — registers IPC handlers, creates window
    window-manager.ts BrowserWindow lifecycle
    features/
      session/        PTY management (node-pty), session registry, IPC handlers
      settings/       settings persistence (electron-store)
      fs/             filesystem, git, shell detection IPC handlers
      notes/          notes persistence
      window/         window control, detach/reattach
      persistence/    layout/session persistence across restarts
      updater/        electron-updater

  preload/
    index.ts          exposes typed `window.ipc` bridge (contextBridge)

  renderer/           React app
    App.tsx           root component — layout shell, status bar, modal mounting
    store/
      root.store.ts   Zustand root store (composed from slices)
    features/         vertical slice — each feature is self-contained
      session/        session tabs, pane layout, store slice, hooks
      terminal/       xterm.js integration (useTerminal, terminal pool)
      layout/         layout tree data structures, DnD
      workspace/      sidebar, git review, worktree stats
      settings/       settings form, presets, settings store slice
      fs/             file viewer, diff view, markdown pane, file tabs
      window/         window state, maximize hook
      updater/        auto-update notifications
    components/       shared UI (modals, title bar, command palette, kbd shortcuts)
    components/ui/    Radix UI primitives (dialog, button, input, etc.)
    lib/
      ipc.ts          typed ipc wrapper for renderer
      utils.ts        cn(), shared utilities

  shared/             imported by all three processes
    ipc-channels.ts   IPC channel name constants (IPC.*)
    ipc-types.ts      Zod schemas + TypeScript types (AppSettings, SessionMeta, etc.)
    constants.ts      DEFAULT_COLS, DEFAULT_ROWS, APP_NAME, SCROLLBACK_BYTE_LIMIT
```

## Three-process model

| Process | Entry | Can access |
|---------|-------|-----------|
| Main | `src/main/index.ts` | Node.js, Electron APIs, filesystem, PTY |
| Preload | `src/preload/index.ts` | Bridges main ↔ renderer via contextBridge |
| Renderer | `src/renderer/main.tsx` | React, DOM, `window.ipc` only |

The renderer never imports Node.js modules. All system access goes through `window.ipc.invoke(IPC.*)`.

## IPC pattern

Every IPC channel follows this layered path:

```
Renderer hook/store
  → *.service.ts          (wraps window.ipc.invoke, typed return)
  → ipc-channels.ts IPC.* constant
  → preload contextBridge
  → main *-ipc.ts handler
  → main *-service.ts / *-store.ts
```

**Rules:**
- Renderer code calls service functions, never `window.ipc.invoke()` directly
- Service files live at `features/X/X.service.ts`
- Main-side handlers live at `main/features/X/X-ipc.ts`
- IPC channel names are always referenced via the `IPC.*` constant, never as string literals

## State management

Zustand with Immer. The store is composed from feature slices:

```
root.store.ts → createSessionSlice + createSettingsSlice + createWindowSlice + createTerminalSlice
```

- Store slices hold state and actions only — no IPC calls inside slices
- Actions that need IPC live in `*.service.ts` and are called from hooks or event handlers
- `useStore((s) => s.field)` for reading; `useStore((s) => s.action)` for actions
- `useStore.getState()` for one-shot reads outside React (e.g., inside effects/callbacks)

## Vertical slice architecture

Each feature is fully self-contained under `src/renderer/features/<feature>/`:

```
features/session/
  components/   pure render, no business logic
  hooks/        all business logic, IPC calls, derived state
  session.store.ts   Zustand slice
  session.service.ts IPC wrappers
```

**The hard rule:** components are pure render. If a component contains:
- IPC calls
- async operations
- `document.addEventListener`
- derived state computation
- store subscriptions beyond simple display

...it belongs in a hook. Extract it.

## Layout system

The pane layout is a binary tree of `LayoutNode` (splits) and `LayoutLeaf` (terminal | notes | markdown | file-viewer). Defined in `features/layout/layout-tree.ts`.

- Every tab in `tabOrder` maps to a tree in `paneTree[tabId]`
- `__root__` is the special home/empty-state tab
- `splitTerminalLeaf`, `removeTerminalLeaf`, `insertAtRight` etc. are pure functions — pass the tree in, get a new tree out
- Layout mutations go through store actions in `session.store.ts`

## Terminal pool

`useTerminal.ts` keeps a module-level `terminalPool: Map<sessionId, PoolEntry>` so xterm instances survive React remounts caused by layout changes. On remount, the DOM element is re-parented rather than replaying history. Instances are fully disposed only when the session is removed from the store (killed).

## Path aliases

| Alias | Resolves to |
|-------|-------------|
| `@shared` | `src/shared/` |
| `@renderer` | `src/renderer/` |
| `@` | `src/renderer/` |

## Styling

- Tailwind CSS with `cn()` from `lib/utils.ts` (clsx + tailwind-merge)
- Theme-aware custom properties: `bg-brand-surface`, `bg-brand-panel`, `text-brand-accent`, `text-brand-muted`, `bg-brand-bg`
- These map to CSS vars that swap per theme (dark/light/space/nebula/solar/aurora)
- `__APP_VERSION__` is a build-time global injected by electron-vite — declare it with `declare const __APP_VERSION__: string` in any file that uses it

## Shared constants — always use these

```typescript
import { DEFAULT_COLS, DEFAULT_ROWS } from '@shared/constants'
// Never hardcode: cols: 80, rows: 24
```

Session color constants and `SESSION_COLORS` live in `session.service.ts`.

## Key types

```typescript
// src/shared/ipc-types.ts
AppSettings       // full user settings (Zod-validated, default via AppSettingsSchema.parse({}))
SessionMeta       // running session metadata (id, name, color, cwd, groupId, status, ...)
PersistedSession  // what gets saved to disk across restarts
LayoutNode        // split | leaf union for pane tree
```

## Releases

Triggered by pushing a `v*` tag. Workflow: `.github/workflows/release.yml`
- Creates a draft release
- Builds Windows + Linux in parallel
- Auto-publishes when both pass

```bash
git tag v0.X.Y && git push origin v0.X.Y
```

## What not to do

- No `window.ipc.invoke()` calls in components or store slices — use service functions
- No business logic, async ops, or event listeners in components — extract to hooks
- No `as any` — fix the type instead
- No hardcoded `cols: 80, rows: 24` — use `DEFAULT_COLS` / `DEFAULT_ROWS`
- No duplicate constant definitions — check `@shared/constants` and `session.service.ts` first
- No inline `replace(/\\/g, '/')` — use `normalizePath()` from `lib/utils.ts` (needs adding — see REVIEW.md)
- No new shared component that isn't under `components/` or the feature's own `components/` folder
