import type { StateCreator } from 'zustand'
import type { SessionMeta, PersistedLayout } from '@shared/ipc-types'
import type { RootStore } from '../../store/root.store'
import { makeLeaf, splitLeaf, removeLeaf, collectSessionIds, findTabForSession } from '../terminal/pane-tree'
import type { PaneNode } from '../terminal/pane-tree'

export type { PaneNode }

export interface SessionSlice {
  sessions: Record<string, SessionMeta>
  tabOrder: string[]
  activeSessionId: string | null
  focusedSessionId: string | null
  paneTree: Record<string, PaneNode>
  pendingRestore: PersistedLayout | null
  isRestoringLayout: boolean

  upsertSession: (meta: SessionMeta) => void
  setActiveSession: (sessionId: string | null) => void
  setFocusedSession: (sessionId: string | null) => void
  reorderTabs: (newOrder: string[]) => void
  markSessionExited: (sessionId: string, exitCode: number) => void
  addTab: (sessionId: string) => void
  removeTab: (tabId: string) => void
  splitPane: (
    tabId: string,
    targetSessionId: string,
    direction: 'horizontal' | 'vertical',
    newMeta: SessionMeta
  ) => void
  closePane: (tabId: string, sessionId: string) => void
  detachPane: (tabId: string, sessionId: string) => void
  removePaneBySessionId: (sessionId: string) => void
  setPendingRestore: (layout: PersistedLayout | null) => void
  setIsRestoringLayout: (v: boolean) => void
  restoreTab: (tabId: string, tree: PaneNode, metas: SessionMeta[]) => void
  openGroupInSplits: (sessionIds: string[]) => void
}

export const createSessionSlice: StateCreator<RootStore, [['zustand/immer', never]], [], SessionSlice> = (set) => ({
  sessions: {},
  tabOrder: [],
  activeSessionId: null,
  focusedSessionId: null,
  paneTree: {},
  pendingRestore: null,
  isRestoringLayout: false,

  upsertSession: (meta) =>
    set((state) => {
      state.sessions[meta.sessionId] = meta
    }),

  addTab: (sessionId) =>
    set((state) => {
      if (!state.tabOrder.includes(sessionId)) {
        state.tabOrder.push(sessionId)
        state.paneTree[sessionId] = makeLeaf(sessionId)
      }
      state.activeSessionId = sessionId
      state.focusedSessionId = sessionId
    }),

  removeTab: (tabId) =>
    set((state) => {
      const idx = state.tabOrder.indexOf(tabId)
      state.tabOrder = state.tabOrder.filter((id) => id !== tabId)
      const tree = state.paneTree[tabId]
      if (tree) {
        collectSessionIds(tree).forEach((sid) => delete state.sessions[sid])
        delete state.paneTree[tabId]
      }
      if (state.activeSessionId === tabId) {
        state.activeSessionId =
          state.tabOrder[Math.max(0, idx - 1)] ?? state.tabOrder[0] ?? null
      }
    }),

  splitPane: (tabId, targetSessionId, direction, newMeta) =>
    set((state) => {
      state.sessions[newMeta.sessionId] = newMeta
      const tree = state.paneTree[tabId]
      if (tree) {
        state.paneTree[tabId] = splitLeaf(tree, targetSessionId, direction, newMeta.sessionId)
      }
    }),

  closePane: (tabId, sessionId) =>
    set((state) => {
      const tree = state.paneTree[tabId]
      if (!tree) return
      delete state.sessions[sessionId]
      const newTree = removeLeaf(tree, sessionId)
      if (!newTree) {
        state.tabOrder = state.tabOrder.filter((id) => id !== tabId)
        delete state.paneTree[tabId]
        if (state.activeSessionId === tabId) {
          state.activeSessionId = state.tabOrder[0] ?? null
        }
      } else {
        state.paneTree[tabId] = newTree
      }
    }),

  detachPane: (tabId, sessionId) =>
    set((state) => {
      // Remove from tree without killing the session — it continues in a new window
      const tree = state.paneTree[tabId]
      if (!tree) return
      const newTree = removeLeaf(tree, sessionId)
      if (!newTree) {
        state.tabOrder = state.tabOrder.filter((id) => id !== tabId)
        delete state.paneTree[tabId]
        if (state.activeSessionId === tabId) {
          state.activeSessionId = state.tabOrder[0] ?? null
        }
      } else {
        state.paneTree[tabId] = newTree
      }
    }),

  removePaneBySessionId: (sessionId) =>
    set((state) => {
      const tabId = findTabForSession(state.paneTree, sessionId)
      if (!tabId) return
      const tree = state.paneTree[tabId]
      if (!tree) return
      // Don't auto-close if it's the only pane in the tab — show exited state instead
      if (collectSessionIds(tree).length <= 1) return
      delete state.sessions[sessionId]
      const newTree = removeLeaf(tree, sessionId)
      if (!newTree) {
        state.tabOrder = state.tabOrder.filter((id) => id !== tabId)
        delete state.paneTree[tabId]
        if (state.activeSessionId === tabId) {
          state.activeSessionId = state.tabOrder[0] ?? null
        }
      } else {
        state.paneTree[tabId] = newTree
      }
    }),

  setFocusedSession: (sessionId) =>
    set((state) => {
      state.focusedSessionId = sessionId
    }),

  setActiveSession: (sessionId) =>
    set((state) => {
      state.activeSessionId = sessionId
    }),

  reorderTabs: (newOrder) =>
    set((state) => {
      state.tabOrder = newOrder
    }),

  markSessionExited: (sessionId, exitCode) =>
    set((state) => {
      if (state.sessions[sessionId]) {
        state.sessions[sessionId].status = 'exited'
        state.sessions[sessionId].exitCode = exitCode
      }
    }),

  setPendingRestore: (layout) =>
    set((state) => {
      state.pendingRestore = layout
    }),

  setIsRestoringLayout: (v) =>
    set((state) => {
      state.isRestoringLayout = v
    }),

  restoreTab: (tabId, tree, metas) =>
    set((state) => {
      if (!state.tabOrder.includes(tabId)) {
        state.tabOrder.push(tabId)
      }
      state.paneTree[tabId] = tree
      for (const meta of metas) {
        state.sessions[meta.sessionId] = meta
      }
      state.activeSessionId = tabId
      state.focusedSessionId = tabId
    }),

  openGroupInSplits: (sessionIds) =>
    set((state) => {
      const running = sessionIds.filter((id) => state.sessions[id]?.status === 'running')
      if (running.length === 0) return

      const first = running[0]
      const existingTabId = findTabForSession(state.paneTree, first)
      const tabId = existingTabId ?? first

      if (!existingTabId) {
        if (!state.tabOrder.includes(tabId)) state.tabOrder.push(tabId)
        state.paneTree[tabId] = makeLeaf(first)
      }

      // Remove remaining sessions from their current tabs (keep them in state.sessions)
      for (const sid of running.slice(1)) {
        const oldTabId = findTabForSession(state.paneTree, sid)
        if (oldTabId && oldTabId !== tabId) {
          const oldTree = state.paneTree[oldTabId]
          if (oldTree) {
            const newOldTree = removeLeaf(oldTree, sid)
            if (!newOldTree) {
              state.tabOrder = state.tabOrder.filter((id) => id !== oldTabId)
              delete state.paneTree[oldTabId]
              if (state.activeSessionId === oldTabId) {
                state.activeSessionId = state.tabOrder[0] ?? null
              }
            } else {
              state.paneTree[oldTabId] = newOldTree
            }
          }
        }
      }

      if (running.length === 1) {
        state.activeSessionId = tabId
        return
      }

      // Build grid: numCols = ceil(sqrt(n)), sessions fill columns left-to-right
      const n = running.length
      const numCols = Math.ceil(Math.sqrt(n))
      const cols: string[][] = Array.from({ length: numCols }, () => [])
      running.forEach((sid, i) => cols[i % numCols].push(sid))

      // Add columns via horizontal splits (anchor = first session in previous column)
      const colAnchors: string[] = [cols[0][0]]
      for (let c = 1; c < cols.length; c++) {
        if (cols[c].length === 0) continue
        const firstInCol = cols[c][0]
        const tree = state.paneTree[tabId]
        if (tree) state.paneTree[tabId] = splitLeaf(tree, colAnchors[c - 1], 'horizontal', firstInCol)
        colAnchors.push(firstInCol)
      }

      // Add rows within each column via vertical splits
      for (let c = 0; c < cols.length; c++) {
        for (let r = 1; r < cols[c].length; r++) {
          const tree = state.paneTree[tabId]
          if (tree) state.paneTree[tabId] = splitLeaf(tree, cols[c][r - 1], 'vertical', cols[c][r])
        }
      }

      state.activeSessionId = tabId
      if (!state.tabOrder.includes(tabId)) state.tabOrder.push(tabId)
    }),
})
