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
  restoreTab: (tabId: string, tree: PaneNode, metas: SessionMeta[]) => void
}

export const createSessionSlice: StateCreator<RootStore, [['zustand/immer', never]], [], SessionSlice> = (set) => ({
  sessions: {},
  tabOrder: [],
  activeSessionId: null,
  focusedSessionId: null,
  paneTree: {},
  pendingRestore: null,

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
    })
})
