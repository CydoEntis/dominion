import { Minus, Square, X } from 'lucide-react'
import { sendWindowControl } from '../features/window/window.service'
import { useWindowMaximized } from '../features/window/hooks/useWindowMaximized'
import { APP_NAME } from '@shared/constants'
import logoUrl from '../assets/logo.png'

interface Props {
  title: string
  subtitle?: string
}

export function TitleBar({ title, subtitle }: Props): JSX.Element {
  const isMaximized = useWindowMaximized()

  return (
    <div
      className="flex items-center h-[52px] bg-brand-bg border-b border-brand-panel flex-shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo + name */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0 w-44">
        <img src={logoUrl} alt="logo" className="w-6 h-6 object-contain flex-shrink-0" />
        <span className="text-xs font-semibold text-brand-light tracking-wide whitespace-nowrap">
          {APP_NAME}
        </span>
      </div>

      {/* Center: active context */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-4">
        <span className="text-xs font-medium text-zinc-200 truncate max-w-xs">{title}</span>
        {subtitle && (
          <span className="text-[10px] text-zinc-600 truncate max-w-xs">{subtitle}</span>
        )}
      </div>

      {/* Window controls */}
      <div
        className="flex items-center gap-1 px-2 flex-shrink-0 w-44 justify-end"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button onClick={() => sendWindowControl('minimize')} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50 transition-colors rounded" title="Minimize">
          <Minus size={11} />
        </button>
        <button onClick={() => sendWindowControl('maximize')} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50 transition-colors rounded" title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="0.5" width="7" height="7" rx="0.5" />
              <path d="M0.5 3.5v7h7V8" />
            </svg>
          ) : (
            <Square size={10} />
          )}
        </button>
        <button onClick={() => sendWindowControl('close')} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded" title="Close">
          <X size={11} />
        </button>
      </div>
    </div>
  )
}
