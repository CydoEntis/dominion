import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Zap, Trash2, Plus, FolderOpen } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { createSession } from '../../session/session.service'
import { pickFolder } from '../../window/window.service'
import { cn } from '../../../lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Input } from '../../../components/ui/input'
import type { Preset } from '@shared/ipc-types'

const AGENT_OPTIONS = [
  { value: 'shell', label: 'Shell (plain)' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
]

interface AddFormState {
  name: string
  agentCommand: string
  cwd: string
}

function AddPresetForm({ onSave, onCancel }: { onSave: (data: AddFormState) => void; onCancel: () => void }): JSX.Element {
  const [form, setForm] = useState<AddFormState>({ name: '', agentCommand: 'shell', cwd: '' })

  const handlePickFolder = async (): Promise<void> => {
    const folder = await pickFolder()
    if (folder) setForm((f) => ({ ...f, cwd: folder }))
  }

  return (
    <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
      <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">New Preset</p>
      <Input
        autoFocus
        placeholder="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <Select value={form.agentCommand} onValueChange={(v) => setForm((f) => ({ ...f, agentCommand: v }))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AGENT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input
          placeholder="Working dir (optional)"
          value={form.cwd}
          onChange={(e) => setForm((f) => ({ ...f, cwd: e.target.value }))}
          className="flex-1"
        />
        <button
          onClick={handlePickFolder}
          className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Browse folder"
        >
          <FolderOpen size={14} />
        </button>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm rounded bg-brand-surface hover:bg-brand-panel text-zinc-400 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          disabled={!form.name.trim()}
          className="flex-1 py-2 text-sm rounded bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 disabled:opacity-40 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

interface PresetsMenuProps {
  iconOnly?: boolean
}

export function PresetsMenu({ iconOnly }: PresetsMenuProps = {}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)

  const presets: Preset[] = settings.presets ?? []

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as Element
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target) ||
        target.closest('[data-radix-popper-content-wrapper]')
      )
        return
      setOpen(false)
      setShowAdd(false)
    }
    document.addEventListener('mousedown', handler, { capture: true })
    return () => document.removeEventListener('mousedown', handler, { capture: true })
  }, [open])

  const launchPreset = async (preset: Preset): Promise<void> => {
    try {
      const meta = await createSession({
        name: preset.name,
        agentCommand: preset.agentCommand || undefined,
        cwd: preset.cwd || undefined,
        cols: 80,
        rows: 24
      })
      upsertSession(meta)
      addTab(meta.sessionId)
    } catch {}
    setOpen(false)
  }

  const deletePreset = async (id: string): Promise<void> => {
    await updateSettings({ presets: presets.filter((p) => p.id !== id) })
  }

  const savePreset = async (data: AddFormState): Promise<void> => {
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      agentCommand: data.agentCommand === 'shell' ? undefined : data.agentCommand.trim() || undefined,
      cwd: data.cwd.trim() || undefined
    }
    await updateSettings({ presets: [...presets, newPreset] })
    setShowAdd(false)
  }

  const rect = buttonRef.current?.getBoundingClientRect()
  const menuStyle = rect
    ? iconOnly
      ? { bottom: window.innerHeight - rect.bottom, left: rect.right + 4 }
      : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
    : { top: 44, right: 80 }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => { setOpen((v) => !v); setShowAdd(false) }}
        className={cn(
          'flex items-center justify-center transition-colors border-l-2',
          iconOnly
            ? cn('w-12 h-12 flex-shrink-0',
                open
                  ? 'border-l-brand-accent text-brand-muted bg-brand-panel/40'
                  : 'border-l-transparent text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/20'
              )
            : cn('gap-1.5 px-2.5 h-7 rounded text-xs font-medium border-l-transparent',
                open
                  ? 'bg-brand-accent/10 text-brand-muted'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )
        )}
        title="Launch presets"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Zap size={iconOnly ? 20 : 12} />
        {!iconOnly && <span>Presets</span>}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', zIndex: 9999, width: 300, ...menuStyle }}
            className="bg-brand-surface border border-brand-panel/60 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto">
              {presets.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-6">No presets saved yet</p>
              )}
              {presets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => launchPreset(p)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-brand-panel group transition-colors cursor-pointer"
                >
                  <Zap size={11} className="text-brand-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {p.agentCommand ?? 'shell'}
                      {p.cwd ? ` · ${p.cwd.split(/[\\/]/).pop()}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePreset(p.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-brand-panel transition-all"
                    title="Delete preset"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            {showAdd ? (
              <AddPresetForm onSave={savePreset} onCancel={() => setShowAdd(false)} />
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-brand-panel border-t border-brand-panel transition-colors"
              >
                <Plus size={11} />
                New Preset
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
