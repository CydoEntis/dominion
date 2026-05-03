import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../../store/root.store'
import { findTabForSession } from '../../terminal/pane-tree'
import { createSession } from '../session.service'
import type { Preset } from '@shared/ipc-types'

export interface PaletteItem {
  id: string
  label: string
  description?: string
  iconName: string
  action: () => void | Promise<void>
}

export function useCommandPalette(open: boolean, onClose: () => void): {
  query: string
  setQuery: (q: string) => void
  selectedIdx: number
  items: PaletteItem[]
} {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const paneTree = useStore((s) => s.paneTree)
  const setActiveSession = useStore((s) => s.setActiveSession)
  const setFocusedSession = useStore((s) => s.setFocusedSession)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const toggleDashboard = useStore((s) => s.toggleDashboard)

  useEffect(() => {
    if (!open) { setQuery(''); setSelectedIdx(0) }
  }, [open])

  useEffect(() => setSelectedIdx(0), [query])

  const q = query.toLowerCase()

  const items: PaletteItem[] = []

  Object.values(sessions)
    .filter((m) => m.status === 'running' && (!q || m.name.toLowerCase().includes(q)))
    .forEach((m) => items.push({
      id: `session-${m.sessionId}`,
      label: m.name,
      description: m.cwd,
      iconName: 'Terminal',
      action: () => {
        const tabId = findTabForSession(paneTree, m.sessionId)
        if (tabId) { setActiveSession(tabId); setFocusedSession(m.sessionId) }
        onClose()
      }
    }))

  ;(settings.presets ?? [])
    .filter((p: Preset) => !q || p.name.toLowerCase().includes(q))
    .forEach((p: Preset) => items.push({
      id: `preset-${p.id}`,
      label: p.name,
      description: p.agentCommand ?? 'shell',
      iconName: 'Zap',
      action: async () => {
        try {
          const meta = await createSession({ name: p.name, agentCommand: p.agentCommand, cwd: p.cwd, cols: 80, rows: 24 })
          upsertSession(meta)
          addTab(meta.sessionId)
        } catch {}
        onClose()
      }
    }))

  const actions: PaletteItem[] = [
    { id: 'new-session',   label: 'New Session',           description: 'Ctrl+T',       iconName: 'Plus',       action: () => { document.dispatchEvent(new CustomEvent('acc:new-session'));   onClose() } },
    { id: 'open-project',  label: 'Open Project',          description: 'Ctrl+O',       iconName: 'FolderOpen', action: () => { document.dispatchEvent(new CustomEvent('acc:open-project'));  onClose() } },
    { id: 'toggle-sidebar',label: 'Toggle Sidebar',        description: 'Ctrl+B',       iconName: 'PanelLeft',  action: () => { toggleDashboard();                                            onClose() } },
    { id: 'close-tab',     label: 'Close Active Tab',      description: 'Ctrl+W',       iconName: 'X',          action: () => { document.dispatchEvent(new CustomEvent('acc:close-tab'));    onClose() } },
    { id: 'detach-pane',   label: 'Detach Pane to Window', description: 'Ctrl+Shift+D', iconName: 'Maximize2',  action: () => { document.dispatchEvent(new CustomEvent('acc:detach-pane')); onClose() } },
  ].filter((a) => !q || a.label.toLowerCase().includes(q))

  actions.forEach((a) => items.push(a))

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && items[selectedIdx]) items[selectedIdx].action()
  }, [open, items, selectedIdx, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [handleKeyDown])

  return { query, setQuery, selectedIdx, items }
}
