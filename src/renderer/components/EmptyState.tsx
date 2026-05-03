import logoUrl from '../assets/logo.png'

interface KeybindRow {
  keys: string[]
  label: string
  action?: () => void
}

function Key({ label }: { label: string }): JSX.Element {
  return (
    <kbd className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-brand-panel border border-brand-panel/80 shadow-[0_2px_0_rgba(0,0,0,0.5)] font-mono text-[11px] text-zinc-300 leading-5 min-w-[1.75rem]">
      {label}
    </kbd>
  )
}

function KeybindEntry({ keys, label, action }: KeybindRow): JSX.Element {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors group ${action ? 'cursor-pointer hover:bg-brand-panel/40' : ''}`}
      onClick={action}
    >
      <div className="flex items-center gap-1 min-w-[120px] justify-end">
        {keys.map((k, i) => (
          <Key key={i} label={k} />
        ))}
      </div>
      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</span>
    </div>
  )
}

export function EmptyState(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none">
      <img src={logoUrl} alt="Dominion" className="w-24 h-24 object-contain opacity-90" />

      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-light tracking-wide">Dominion</h1>
        <p className="text-xs text-zinc-600 mt-1 tracking-widest uppercase">Agent Control Center</p>
      </div>

      <div className="w-64 h-px bg-brand-panel" />

      <div className="flex flex-col gap-0.5">
        <KeybindEntry keys={['Ctrl', 'T']} label="New session" action={() => document.dispatchEvent(new CustomEvent('acc:new-session'))} />
        <KeybindEntry keys={['Ctrl', 'O']} label="Open project" action={() => document.dispatchEvent(new CustomEvent('acc:open-project'))} />
        <KeybindEntry keys={['Ctrl', 'P']} label="Command palette" action={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true }))} />
        <KeybindEntry keys={['Ctrl', 'B']} label="Toggle sidebar" action={() => document.dispatchEvent(new CustomEvent('acc:toggle-sidebar'))} />
        <div className="h-px bg-brand-panel/50 mx-4 my-1" />
        <KeybindEntry keys={['Ctrl', 'W']} label="Close active tab" />
        <KeybindEntry keys={['Ctrl', 'Shift', 'D']} label="Detach pane to window" />
      </div>

      <p className="text-[10px] text-zinc-700 tracking-wider">v0.1.0</p>
    </div>
  )
}
