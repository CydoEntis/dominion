import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Terminal, Zap, Plus, LayoutDashboard } from 'lucide-react'
import { useStore } from '../store/root.store'
import { findTabForSession } from '../features/terminal/pane-tree'
import { createSession } from '../features/session/session.service'
import { cn } from '../lib/utils'
import type { Preset } from '@shared/ipc-types'

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 2) return p.replace(/\\/g, '/')
  return `…/${parts.slice(-2).join('/')}`
}

interface Item {
  id: string
  label: string
  description?: string
  icon: JSX.Element
  action: () => void | Promise<void>
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props): JSX.Element | null {
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
    if (!open) {
      setQuery('')
      setSelectedIdx(0)
    }
  }, [open])

  const q = query.toLowerCase()

  const items: Item[] = []

  Object.values(sessions)
    .filter((m) => m.status === 'running' && (!q || m.name.toLowerCase().includes(q)))
    .forEach((m) =>
      items.push({
        id: `session-${m.sessionId}`,
        label: m.name,
        description: shortPath(m.cwd),
        icon: <Terminal size={12} />,
        action: () => {
          const tabId = findTabForSession(paneTree, m.sessionId)
          if (tabId) {
            setActiveSession(tabId)
            setFocusedSession(m.sessionId)
          }
          onClose()
        }
      })
    )

  ;(settings.presets ?? [])
    .filter((p: Preset) => !q || p.name.toLowerCase().includes(q))
    .forEach((p: Preset) =>
      items.push({
        id: `preset-${p.id}`,
        label: p.name,
        description: p.agentCommand ?? 'shell',
        icon: <Zap size={12} />,
        action: async () => {
          try {
            const meta = await createSession({
              name: p.name,
              agentCommand: p.agentCommand,
              cwd: p.cwd,
              cols: 80,
              rows: 24
            })
            upsertSession(meta)
            addTab(meta.sessionId)
          } catch {}
          onClose()
        }
      })
    )

  const actions: Item[] = [
    {
      id: 'new-session',
      label: 'New Session',
      description: 'Ctrl+T',
      icon: <Plus size={12} />,
      action: () => {
        document.dispatchEvent(new CustomEvent('acc:new-session'))
        onClose()
      }
    },
    {
      id: 'toggle-dashboard',
      label: 'Toggle Dashboard',
      description: 'Session overview',
      icon: <LayoutDashboard size={12} />,
      action: () => {
        toggleDashboard()
        onClose()
      }
    }
  ].filter((a) => !q || a.label.toLowerCase().includes(q))

  actions.forEach((a) => items.push(a))

  useEffect(() => setSelectedIdx(0), [query])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, items.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && items[selectedIdx]) {
        items[selectedIdx].action()
      }
    },
    [open, items, selectedIdx, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [handleKeyDown])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[15vh]"
      onMouseDown={() => onClose()}
    >
      <div
        className="bg-brand-surface border border-brand-panel/80 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-brand-panel">
          <Search size={14} className="text-zinc-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, presets, actions…"
            className="bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none flex-1"
          />
          <kbd className="text-[10px] text-zinc-600 border border-brand-panel rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-1.5">
          {items.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">No results</p>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => item.action()}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
                idx === selectedIdx
                  ? 'bg-brand-green/20 text-zinc-100'
                  : 'text-zinc-300 hover:bg-brand-panel/60'
              )}
            >
              <span className="text-zinc-400 flex-shrink-0 w-3.5 flex items-center justify-center">
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.description && (
                <span className="text-xs text-zinc-500 flex-shrink-0">{item.description}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
