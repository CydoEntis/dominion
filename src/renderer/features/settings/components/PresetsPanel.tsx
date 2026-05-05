import { useState } from 'react'
import { Plus, Trash2, Zap, FolderOpen } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { createSession } from '../../session/session.service'
import { pickFolder } from '../../window/window.service'
import { Input } from '../../../components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../../components/ui/select'
import type { Preset } from '@shared/ipc-types'

const AGENT_OPTIONS = [
  { value: 'shell',  label: 'Shell (plain)' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex',  label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
]

interface FormState { name: string; agentCommand: string; cwd: string }

const EMPTY_FORM: FormState = { name: '', agentCommand: 'shell', cwd: '' }

export function PresetsPanel(): JSX.Element {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const settings      = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab        = useStore((s) => s.addTab)

  const presets: Preset[] = settings.presets ?? []

  const openAdd = (): void => { setForm(EMPTY_FORM); setShowAdd(true) }
  const cancelAdd = (): void => setShowAdd(false)

  const launchPreset = async (preset: Preset): Promise<void> => {
    try {
      const meta = await createSession({
        name: preset.name,
        agentCommand: preset.agentCommand || undefined,
        cwd: preset.cwd || undefined,
        cols: 80,
        rows: 24,
      })
      upsertSession(meta)
      addTab(meta.sessionId)
    } catch {}
  }

  const deletePreset = async (id: string): Promise<void> => {
    await updateSettings({ presets: presets.filter((p) => p.id !== id) })
  }

  const savePreset = async (): Promise<void> => {
    if (!form.name.trim()) return
    const next: Preset = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      agentCommand: form.agentCommand === 'shell' ? undefined : form.agentCommand || undefined,
      cwd: form.cwd.trim() || undefined,
    }
    await updateSettings({ presets: [...presets, next] })
    setShowAdd(false)
  }

  const handlePickFolder = async (): Promise<void> => {
    const folder = await pickFolder()
    if (folder) setForm((f) => ({ ...f, cwd: folder }))
  }

  return (
    <div className="flex flex-col h-full bg-brand-bg">

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-brand-panel flex-shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Presets</span>
        <button
          onClick={openAdd}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/60 transition-colors"
          title="New preset"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Inline add form */}
      {showAdd && (
        <div className="border-b border-brand-panel p-3 flex flex-col gap-2.5 flex-shrink-0">
          <Input
            autoFocus
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') cancelAdd() }}
          />
          <Select value={form.agentCommand} onValueChange={(v) => setForm((f) => ({ ...f, agentCommand: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
              className="flex-1 text-xs"
            />
            <button
              onClick={handlePickFolder}
              className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Browse folder"
            >
              <FolderOpen size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelAdd}
              className="flex-1 py-1.5 text-xs rounded bg-brand-surface hover:bg-brand-panel text-zinc-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={savePreset}
              disabled={!form.name.trim()}
              className="flex-1 py-1.5 text-xs rounded bg-brand-green/20 text-brand-green hover:bg-brand-green/30 disabled:opacity-40 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-xs text-zinc-600 text-center">No presets yet</p>
            <button onClick={openAdd} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Create one →
            </button>
          </div>
        )}
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => launchPreset(p)}
            className="w-full text-left px-3 py-2.5 border-b border-brand-panel/30 hover:bg-brand-panel/30 transition-colors group relative"
          >
            <div className="flex items-center gap-2 pr-6">
              <Zap size={11} className="text-brand-light flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {p.agentCommand ?? 'shell'}
                  {p.cwd ? ` · ${p.cwd.split(/[\\/]/).pop()}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deletePreset(p.id) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 transition-all"
              title="Delete preset"
            >
              <Trash2 size={10} />
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}
