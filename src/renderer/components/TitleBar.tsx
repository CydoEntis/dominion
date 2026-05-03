import { Minus, Square, X, Minimize2 } from 'lucide-react'
import { SessionTabBar } from '../features/session/components/SessionTabBar'
import { sendWindowControl } from '../features/window/window.service'
import { useWindowMaximized } from '../features/window/hooks/useWindowMaximized'
import { PresetsMenu } from '../features/settings/components/PresetsMenu'
import { cn } from '../lib/utils'
import { APP_NAME } from '@shared/constants'
import logoUrl from '../assets/logo.png'

interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}

interface Props {
  activity: 'sessions' | 'projects'
  openFiles: OpenFile[]
  activeFilePath: string | null
  onActivateFile: (path: string) => void
  onCloseFile: (path: string) => void
}

function shortName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export function TitleBar({ activity, openFiles, activeFilePath, onActivateFile, onCloseFile }: Props): JSX.Element {
  const isMaximized = useWindowMaximized()

  return (
    <div
      className="flex items-center h-12 bg-brand-bg border-b border-brand-panel flex-shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo + name */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0">
        <img src={logoUrl} alt="logo" className="w-9 h-9 object-contain flex-shrink-0" />
        <span className="text-xs font-semibold text-brand-light tracking-wide whitespace-nowrap">
          {APP_NAME}
        </span>
        <div className="w-px h-4 bg-brand-panel mx-1" />
      </div>

      {/* Context-sensitive tab bar — container inherits drag; individual tabs opt out */}
      <div className="flex items-center h-full flex-1 min-w-0 overflow-x-auto">
        {activity === 'sessions' ? (
          <SessionTabBar />
        ) : (
          openFiles.length === 0 ? (
            <span className="text-xs text-zinc-600 px-3">No files open</span>
          ) : (
            openFiles.map((f) => {
              const isActive = f.path === activeFilePath
              return (
                <div
                  key={f.path}
                  onClick={() => onActivateFile(f.path)}
                  title={f.path}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className={cn(
                    'relative flex items-center gap-2 px-4 h-full border-r border-brand-panel cursor-pointer flex-shrink-0 min-w-[120px] max-w-[200px] group transition-colors',
                    isActive ? 'bg-brand-panel/60 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/30'
                  )}
                >
                  {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green" />}
                  {f.hasChanges && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
                  <span className="text-sm font-medium truncate flex-1">{shortName(f.path)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCloseFile(f.path) }}
                    className={cn(
                      'flex-shrink-0 transition-colors hover:text-zinc-100',
                      isActive ? 'text-zinc-400' : 'text-zinc-700 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <X size={12} />
                  </button>
                </div>
              )
            })
          )
        )}
      </div>

      {/* Right controls */}
      <div
        className="flex items-center gap-1 px-2 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <PresetsMenu />
        <div className="w-px h-4 bg-brand-panel mx-1" />
        <button onClick={() => sendWindowControl('minimize')} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50 transition-colors rounded" title="Minimize">
          <Minus size={12} />
        </button>
        <button onClick={() => sendWindowControl('maximize')} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50 transition-colors rounded" title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <Minimize2 size={11} /> : <Square size={11} />}
        </button>
        <button onClick={() => sendWindowControl('close')} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded" title="Close">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
