import logoUrl from '../assets/logo.png'
import { useStore } from '../store/root.store'

function Key({ label }: { label: string }): JSX.Element {
  return (
    <kbd className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-brand-panel border border-brand-panel/80 shadow-[0_2px_0_rgba(0,0,0,0.5)] font-mono text-[11px] text-zinc-300 leading-5 min-w-[1.75rem]">
      {label}
    </kbd>
  )
}

function parseHotkey(hotkey: string): string[] {
  return hotkey.split('+').map((k) => k.trim())
}

function KeybindEntry({ hotkey, label, action }: { hotkey: string; label: string; action?: () => void }): JSX.Element {
  const keys = parseHotkey(hotkey)
  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors group ${action ? 'cursor-pointer hover:bg-brand-panel/40' : ''}`}
      onClick={action}
    >
      <div className="flex items-center gap-1 min-w-[110px] justify-end">
        {keys.map((k, i) => <Key key={i} label={k} />)}
      </div>
      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</span>
    </div>
  )
}

export function EmptyState(): JSX.Element {
  const hotkeys = useStore((s) => s.settings.hotkeys)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 select-none">
      <img src={logoUrl} alt="Shepherd" className="w-20 h-20 object-contain opacity-90" />

      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-green tracking-wide">Shepherd</h1>
      </div>

      <div className="w-56 h-px bg-brand-panel" />

      <div className="flex flex-col gap-0">
        <KeybindEntry hotkey={hotkeys.newSession} label="New session" action={() => document.dispatchEvent(new CustomEvent('acc:new-session'))} />
        <KeybindEntry hotkey="Ctrl+O" label="Open project" action={() => document.dispatchEvent(new CustomEvent('acc:open-project'))} />
        <KeybindEntry hotkey={hotkeys.commandPalette} label="Command palette" action={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true }))} />
        <KeybindEntry hotkey={hotkeys.toggleDashboard} label="Toggle sidebar" action={() => document.dispatchEvent(new CustomEvent('acc:toggle-sidebar'))} />
        <div className="h-px bg-brand-panel/50 mx-3 my-1" />
        <KeybindEntry hotkey={hotkeys.newNote} label="New note" action={() => document.dispatchEvent(new CustomEvent('acc:new-note'))} />
        <KeybindEntry hotkey={hotkeys.quickNote} label="Quick note" action={() => document.dispatchEvent(new CustomEvent('acc:quick-note'))} />
        <div className="h-px bg-brand-panel/50 mx-3 my-1" />
        <KeybindEntry hotkey={hotkeys.closeSession} label="Close active tab" />
        <KeybindEntry hotkey="Ctrl+Shift+D" label="Detach pane to window" />
      </div>

      <p className="text-[10px] text-zinc-700 tracking-wider">v0.1.0</p>
    </div>
  )
}
