import { Terminal, FolderOpen } from 'lucide-react'
import { cn } from '../lib/utils'

interface Props {
  activity: 'sessions' | 'projects'
  panelOpen: boolean
  onChange: (activity: 'sessions' | 'projects') => void
}

const ITEMS = [
  { id: 'sessions' as const, icon: Terminal, title: 'Sessions' },
  { id: 'projects' as const, icon: FolderOpen, title: 'Projects' },
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
    </div>
  )
}
