import { Terminal, FolderOpen, NotebookPen, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import { PresetsMenu } from '../features/settings/components/PresetsMenu'

interface Props {
  activity: 'sessions' | 'projects' | 'notes' | 'settings'
  panelOpen: boolean
  onChange: (activity: 'sessions' | 'projects' | 'notes' | 'settings') => void
}

const ITEMS = [
  { id: 'sessions' as const, icon: Terminal,     title: 'Sessions' },
  { id: 'projects' as const, icon: FolderOpen,   title: 'Projects' },
  { id: 'notes'    as const, icon: NotebookPen,  title: 'Notes' },
]

export function ActivityBar({ activity, panelOpen, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-col w-12 bg-brand-bg border-r border-brand-panel flex-shrink-0">
      {ITEMS.map(({ id, icon: Icon, title }) => {
        const isActive = activity === id && panelOpen
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
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
      })}
      <div className="flex-1" />
      <div className="border-t border-brand-panel/40">
        <PresetsMenu iconOnly />
        <button
          onClick={() => onChange('settings')}
          title="Settings"
          className={cn(
            'flex items-center justify-center w-12 h-12 transition-colors border-l-2 flex-shrink-0',
            activity === 'settings' && panelOpen
              ? 'border-l-brand-green text-brand-light bg-brand-panel/40'
              : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/20'
          )}
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}
