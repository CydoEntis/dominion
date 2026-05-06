import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useStore } from '../store/root.store'

interface Props {
  open: boolean
  onClose: () => void
}

function Kbd({ keys }: { keys: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.split('+').map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 rounded border border-brand-panel bg-brand-surface text-[10px] text-zinc-300 font-mono"
        >
          {k.trim()}
        </kbd>
      ))}
    </span>
  )
}

interface Row { label: string; binding: string }
interface Section { title: string; rows: Row[] }

export function KeyboardShortcutsModal({ open, onClose }: Props): JSX.Element | null {
  const hk = useStore((s) => s.settings.hotkeys)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, onClose])

  if (!open) return null

  const sections: Section[] = [
    {
      title: 'Global',
      rows: [
        { label: 'Command Palette',    binding: hk.commandPalette },
        { label: 'File Search',        binding: hk.fileSearch },
        { label: 'Toggle Sidebar',     binding: hk.toggleDashboard },
        { label: 'Show Shortcuts',     binding: hk.showShortcuts },
      ]
    },
    {
      title: 'Sessions',
      rows: [
        { label: 'New Session',        binding: hk.newSession },
        { label: 'Close Session',      binding: hk.closeSession },
        { label: 'Open Project',       binding: hk.openProject },
        { label: 'Rename Session',     binding: 'Double-click tab' },
        { label: 'Split Horizontal',   binding: 'Right-click pane' },
        { label: 'Detach Pane',        binding: 'Ctrl+Shift+D' },
      ]
    },
    {
      title: 'Notes',
      rows: [
        { label: 'New Note (sidebar)', binding: hk.newNote },
        { label: 'Quick Note (drawer)',binding: hk.quickNote },
        { label: 'Raw view',           binding: 'Alt+R' },
        { label: 'Preview',            binding: 'Alt+P' },
      ]
    },
    {
      title: 'Terminal',
      rows: [
        { label: 'Copy selection',     binding: 'Ctrl+C (with selection)' },
        { label: 'Paste',              binding: 'Ctrl+Shift+V' },
        { label: 'Open URL / file',    binding: 'Select text, Shift+click' },
      ]
    },
    {
      title: 'File Viewer',
      rows: [
        { label: 'Raw view',           binding: 'Alt+R' },
        { label: 'Markdown preview',   binding: 'Alt+P' },
        { label: 'Diff view',          binding: 'Alt+D' },
      ]
    },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-brand-surface border border-brand-panel/80 rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-panel">
          <span className="text-sm font-semibold text-zinc-200">Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] p-5 grid grid-cols-2 gap-x-8 gap-y-6">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium mb-0.5">{section.title}</p>
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-400">{row.label}</span>
                  <Kbd keys={row.binding} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
