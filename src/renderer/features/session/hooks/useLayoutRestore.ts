import { useEffect, useRef } from 'react'
import { useStore } from '../../../store/root.store'
import { createSession } from '../session.service'
import { detachTab } from '../../window/window.service'
import { clearLayout } from '../persistence.service'
import { collectSessionIds } from '../../terminal/pane-tree'
import type { PersistedLayout } from '@shared/ipc-types'
import type { PaneNode } from '../../terminal/pane-tree'

function remapPaneTree(node: PaneNode, idMap: Map<string, string>): PaneNode {
  if (node.type === 'leaf') {
    return { type: 'leaf', sessionId: idMap.get(node.sessionId) ?? node.sessionId }
  }
  return { ...node, children: node.children.map((c) => remapPaneTree(c, idMap)) }
}

function firstLeafId(node: PaneNode): string {
  if (node.type === 'leaf') return node.sessionId
  return firstLeafId(node.children[0])
}

export function useLayoutRestore(): void {
  const pendingRestore = useStore((s) => s.pendingRestore)
  const setPendingRestore = useStore((s) => s.setPendingRestore)
  const upsertSession = useStore((s) => s.upsertSession)
  const restoreTab = useStore((s) => s.restoreTab)
  const windowId = useStore((s) => s.windowId)

  const windowIdRef = useRef(windowId)
  useEffect(() => { windowIdRef.current = windowId }, [windowId])

  const handleRestore = async (layout: PersistedLayout): Promise<void> => {
    setPendingRestore(null)
    await clearLayout()

    const idMap = new Map<string, string>()
    const createdMetas: Awaited<ReturnType<typeof createSession>>[] = []

    for (const ps of layout.sessions) {
      let agentCommand = ps.agentCommand
      if (agentCommand === 'claude' && ps.conversationId) {
        agentCommand = `claude --resume ${ps.conversationId}`
      }
      try {
        const meta = await createSession({ name: ps.name, agentCommand, cwd: ps.cwd || undefined, cols: 80, rows: 24 })
        upsertSession(meta)
        idMap.set(ps.sessionId, meta.sessionId)
        createdMetas.push(meta)
      } catch {}
    }

    for (const tab of layout.tabs) {
      const tree = tab.tree as PaneNode
      if (!tree) continue
      const newTabId = idMap.get(firstLeafId(tree))
      if (!newTabId) continue

      if (tab.detached) {
        await detachTab(newTabId, windowIdRef.current ?? '')
      } else {
        const remapped = remapPaneTree(tree, idMap)
        const tabSessionIds = new Set(collectSessionIds(remapped))
        const tabMetas = createdMetas.filter((m) => tabSessionIds.has(m.sessionId))
        restoreTab(newTabId, remapped, tabMetas)
      }
    }
  }

  const handleRestoreRef = useRef(handleRestore)
  useEffect(() => { handleRestoreRef.current = handleRestore })

  useEffect(() => {
    if (pendingRestore) {
      handleRestoreRef.current(pendingRestore)
    }
  }, [pendingRestore])
}
