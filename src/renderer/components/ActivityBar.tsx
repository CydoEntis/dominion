import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Terminal, FolderOpen, NotebookPen, Settings, Zap, Sun, Moon, Monitor, LayoutDashboard } from 'lucide-react'
import { cn } from '../lib/utils'
import { useStore } from '../store/root.store'

type Activity = 'sessions' | 'projects' | 'notes' | 'presets' | 'settings' | 'workspace'

interface Props {
  activity: Activity
  panelOpen: boolean
  onChange: (activity: Activity) => void
}

const TOP_ITEMS = [
  { id: 'sessions'  as const, icon: Terminal,        title: 'Sessions' },
  { id: 'projects'  as const, icon: FolderOpen,      title: 'Projects' },
  { id: 'notes'     as const, icon: NotebookPen,     title: 'Notes' },
  { id: 'workspace' as const, icon: LayoutDashboard, title: 'Agent Monitor (Preview)' },
]

const BOTTOM_ITEMS = [
  { id: 'presets'  as const, icon: Zap,      title: 'Presets' },
  { id: 'settings' as const, icon: Settings, title: 'Settings' },
]

const THEMES = [
  { id: 'dark'   as const, label: 'Dark',   icon: Moon    },
  { id: 'light'  as const, label: 'Light',  icon: Sun     },
  { id: 'system' as const, label: 'System', icon: Monitor },
]

function ThemeToggle(): JSX.Element {
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number }>({ left: 52, bottom: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const CurrentIcon = THEMES.find((t) => t.id === theme)?.icon ?? Moon

  const handleOpen = (): void => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ left: rect.right + 4, bottom: window.innerHeight - rect.bottom })
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : handleOpen}
        title="Theme"
        className={cn(
          'flex items-center justify-center w-12 h-12 transition-colors border-l-2 flex-shrink-0',
          open
            ? 'border-l-brand-accent text-brand-muted bg-brand-panel/40'
            : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/20'
        )}
      >
        <CurrentIcon size={18} />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-40"
            style={{ left: menuPos.left, bottom: menuPos.bottom }}
          >
            <p className="px-3 pt-1 pb-0.5 text-[10px] text-zinc-600 uppercase tracking-wider">Theme</p>
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { updateSettings({ theme: id }); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left',
                  theme === id
                    ? 'text-zinc-200 bg-brand-panel/40'
                    : 'text-zinc-400 hover:bg-brand-panel hover:text-zinc-200'
                )}
              >
                <Icon size={12} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

function ActivityButton({ id, icon: Icon, title, isActive, onClick }: {
  id: string; icon: React.ElementType; title: string; isActive: boolean; onClick: () => void
}): JSX.Element {
  return (
    <button
      key={id}
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center justify-center w-12 h-12 transition-colors border-l-2 flex-shrink-0',
        isActive
          ? 'border-l-brand-accent text-brand-muted bg-brand-panel/40'
          : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/20'
      )}
    >
      <Icon size={20} />
    </button>
  )
}

export function ActivityBar({ activity, panelOpen, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-col w-12 bg-brand-bg border-r border-brand-panel flex-shrink-0">
      {TOP_ITEMS.map(({ id, icon, title }) => (
        <ActivityButton
          key={id}
          id={id}
          icon={icon}
          title={title}
          isActive={activity === id && panelOpen}
          onClick={() => onChange(id)}
        />
      ))}
      <div className="flex-1" />
      <div className="border-t border-brand-panel/40">
        <ActivityButton
          id="presets"
          icon={Zap}
          title="Presets"
          isActive={activity === 'presets' && panelOpen}
          onClick={() => onChange('presets')}
        />
        <ThemeToggle />
        <ActivityButton
          id="settings"
          icon={Settings}
          title="Settings"
          isActive={activity === 'settings' && panelOpen}
          onClick={() => onChange('settings')}
        />
      </div>
    </div>
  )
}
