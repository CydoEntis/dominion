import { Terminal, FolderOpen, NotebookPen, Settings, Zap } from 'lucide-react'
import { cn } from '../lib/utils'

type Activity = 'sessions' | 'projects' | 'notes' | 'presets' | 'settings'

interface Props {
  activity: Activity
  panelOpen: boolean
  onChange: (activity: Activity) => void
}

const TOP_ITEMS = [
  { id: 'sessions' as const, icon: Terminal,    title: 'Sessions' },
  { id: 'projects' as const, icon: FolderOpen,  title: 'Projects' },
  { id: 'notes'    as const, icon: NotebookPen, title: 'Notes' },
]

const BOTTOM_ITEMS = [
  { id: 'presets'  as const, icon: Zap,      title: 'Presets' },
  { id: 'settings' as const, icon: Settings, title: 'Settings' },
]

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
          ? 'border-l-brand-green text-brand-light bg-brand-panel/40'
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
        {BOTTOM_ITEMS.map(({ id, icon, title }) => (
          <ActivityButton
            key={id}
            id={id}
            icon={icon}
            title={title}
            isActive={activity === id && panelOpen}
            onClick={() => onChange(id)}
          />
        ))}
      </div>
    </div>
  )
}
