import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, LayoutPanelLeft, SplitSquareHorizontal, Trash2, FileText, GitBranch, Keyboard, GripHorizontal, Shield, AppWindow, MousePointer2, Palette, RefreshCw } from 'lucide-react'

declare const __APP_VERSION__: string

interface Props {
  open: boolean
  onClose: () => void
  onDismiss: () => void
}

interface ChangeEntry {
  icon: React.ReactNode
  title: string
  description: string
}

const CHANGES: ChangeEntry[] = [
  {
    icon: <RefreshCw size={15} />,
    title: 'Linux update and icon fixes',
    description:
      'Fixed "not responding" hang when installing updates on Linux — terminal sessions and windows are now forcibly closed before the installer runs. Improved dock icon registration for Linux desktop environments.',
  },
  {
    icon: <RefreshCw size={15} />,
    title: 'Reliable auto-update and restart',
    description:
      'The updater now restarts the app correctly after installing. Updates that finish downloading before the app fully loads are no longer silently lost.',
  },
  {
    icon: <Shield size={15} />,
    title: 'Sandbox mode for Yolo sessions',
    description:
      'Yolo-mode sessions now run inside a Docker container via sbx, isolating file system and shell access from your host machine. Requires Docker and sbx installed.',
  },
  {
    icon: <AppWindow size={15} />,
    title: 'Window identity in status bar',
    description:
      'When multiple windows are open, your window name now appears centered in the status bar. Click it to rename or recolor the window.',
  },
  {
    icon: <Palette size={15} />,
    title: 'Two new themes',
    description:
      'Mars brings a dark rust and orange-red palette. Pulsar brings near-black navy with electric cyan accents. Both themes include matching terminal colors.',
  },
  {
    icon: <MousePointer2 size={15} />,
    title: 'Context menu polish',
    description:
      'Notes context menus now have icons matching the session menus. The "Move to Window" submenu shows colored squares for each window in all context menus.',
  },
  {
    icon: <LayoutPanelLeft size={15} />,
    title: 'New layout engine',
    description:
      'Sessions now live in a flexible split-pane layout. Clicking a session in the sidebar opens it to the right of your active pane instead of replacing it.',
  },
  {
    icon: <SplitSquareHorizontal size={15} />,
    title: 'Close pane ≠ kill session',
    description:
      'Closing a pane only removes it from the layout — the session keeps running. To end a session, use Kill Session from the right-click menu.',
  },
  {
    icon: <FileText size={15} />,
    title: 'Markdown preview pane',
    description:
      'Open any markdown file in a split preview pane. You can also detach the preview to its own window.',
  },
  {
    icon: <GitBranch size={15} />,
    title: 'Workspace restore',
    description:
      'Restoring a workspace now only brings back panes that belong to that workspace — panes from other workspaces are no longer mixed in.',
  },
  {
    icon: <Keyboard size={15} />,
    title: 'Keybind changes — action required',
    description:
      'All shortcuts moved to Ctrl+Shift+* to avoid terminal conflicts. If your shortcuts feel broken, reset them in Settings → Hotkeys.',
  },
  {
    icon: <GripHorizontal size={15} />,
    title: 'Drag-and-drop layout',
    description:
      'Drag any pane to reorder the layout, or drag a session or note from the sidebar directly into a split. Drop zones appear on the edges of each pane.',
  },
  {
    icon: <Trash2 size={15} />,
    title: 'Notes stay open',
    description:
      'Clicking outside the notes panel no longer closes it. Press Ctrl+Shift+N while notes are open to create a new note instead.',
  },
]

export function ReleaseNotesModal({ open, onClose, onDismiss }: Props): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-brand-surface border border-brand-panel/80 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-panel">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-zinc-200">What's new in v{__APP_VERSION__}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
              New features
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-5 flex flex-col gap-4">
          {CHANGES.map((entry) => (
            <div key={entry.title} className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5 text-brand-accent">{entry.icon}</div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-zinc-200">{entry.title}</span>
                <span className="text-xs text-zinc-400 leading-relaxed">{entry.description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-brand-panel">
          <button
            onClick={onDismiss}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Don't show again
          </button>
          <button
            onClick={onClose}
            className="text-[11px] font-medium px-3 py-1.5 rounded bg-brand-panel hover:bg-brand-panel/70 text-zinc-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
