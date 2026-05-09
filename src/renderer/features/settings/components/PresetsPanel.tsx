import { useState } from 'react'
import { Plus, Trash2, Zap, FolderOpen, Pencil } from 'lucide-react'
import { useStore } from '../../../store/root.store'
import { createSession } from '../../session/session.service'
import { pickFolder } from '../../window/window.service'
import { Input } from '../../../components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../../components/ui/select'
import type { Preset } from '@shared/ipc-types'
import { DEFAULT_COLS, DEFAULT_ROWS } from '@shared/constants'

const AGENT_OPTIONS = [
  { value: 'shell',  label: 'Shell (plain)' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex',  label: 'Codex' },
  { value: 'gemini', label: 'Gemini' },
]

interface FormState { name: string; agentCommand: string; cwd: string }

interface InlineFormProps {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  onSave: () => void
  onCancel: () => void
  onPickFolder: () => void
}

function InlineForm({ f, setF, onSave, onCancel, onPickFolder }: InlineFormProps): JSX.Element {
  return (
    <div className="border-b border-brand-panel p-3 flex flex-col gap-2.5 flex-shrink-0 bg-brand-surface/40">
      <Input
        autoFocus
        placeholder="Name"
        value={f.name}
        onChange={(e) => setF((prev) => ({ ...prev, name: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
      />
      <Select value={f.agentCommand} onValueChange={(v) => setF((prev) => ({ ...prev, agentCommand: v }))}>
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
          value={f.cwd}
          onChange={(e) => setF((prev) => ({ ...prev, cwd: e.target.value }))}
          className="flex-1 text-xs"
        />
        <button
          onClick={onPickFolder}
          className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Browse folder"
        >
          <FolderOpen size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 text-xs rounded bg-brand-surface hover:bg-brand-panel text-zinc-400 transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!f.name.trim()} className="flex-1 py-1.5 text-xs rounded bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 disabled:opacity-40 transition-colors">Save</button>
      </div>
    </div>
  )
}

const EMPTY_FORM: FormState = { name: '', agentCommand: 'shell', cwd: '' }

function presetToForm(p: Preset): FormState {
  return { name: p.name, agentCommand: p.agentCommand ?? 'shell', cwd: p.cwd ?? '' }
}

export function PresetsPanel(): JSX.Element {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const settings       = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const upsertSession  = useStore((s) => s.upsertSession)
  const addTab         = useStore((s) => s.addTab)

  const presets: Preset[] = settings.presets ?? []

  const openAdd = (): void => { setForm(EMPTY_FORM); setShowAdd(true); setEditingId(null) }
  const cancelAdd = (): void => setShowAdd(false)

  const startEdit = (p: Preset, e: React.MouseEvent): void => {
    e.stopPropagation()
    setEditingId(p.id)
    setEditForm(presetToForm(p))
    setShowAdd(false)
  }

  const cancelEdit = (): void => setEditingId(null)

  const launchPreset = async (preset: Preset): Promise<void> => {
    try {
      const meta = await createSession({
        name: preset.name,
        agentCommand: preset.agentCommand || undefined,
        cwd: preset.cwd || undefined,
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
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

  const saveEdit = async (): Promise<void> => {
    if (!editForm.name.trim() || !editingId) return
    const updated: Preset = {
      id: editingId,
      name: editForm.name.trim(),
      agentCommand: editForm.agentCommand === 'shell' ? undefined : editForm.agentCommand || undefined,
      cwd: editForm.cwd.trim() || undefined,
    }
    await updateSettings({ presets: presets.map((p) => p.id === editingId ? updated : p) })
    setEditingId(null)
  }

  const handlePickFolder = async (target: 'add' | 'edit'): Promise<void> => {
    const folder = await pickFolder()
    if (!folder) return
    if (target === 'add') setForm((f) => ({ ...f, cwd: folder }))
    else setEditForm((f) => ({ ...f, cwd: folder }))
  }

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      <div className="flex items-center justify-between px-3 h-10 border-b border-brand-panel flex-shrink-0">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Presets</span>
        <button onClick={openAdd} className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/60 transition-colors" title="New preset">
          <Plus size={14} />
        </button>
      </div>

      {showAdd && (
        <InlineForm f={form} setF={setForm} onSave={savePreset} onCancel={cancelAdd} onPickFolder={() => handlePickFolder('add')} />
      )}

      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
            <p className="text-xs text-zinc-600 text-center">No presets yet</p>
            <button onClick={openAdd} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Create one →</button>
          </div>
        )}
        {presets.map((p) => (
          <div key={p.id} className="flex flex-col">
            <button
              onClick={() => { if (editingId !== p.id) launchPreset(p) }}
              className="w-full text-left px-3 py-2.5 border-b border-brand-panel/30 hover:bg-brand-panel/30 transition-colors group relative"
            >
              <div className="flex items-center gap-2 pr-14">
                <Zap size={11} className="text-brand-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {p.agentCommand ?? 'shell'}
                    {p.cwd ? ` · ${p.cwd.split(/[\\/]/).pop()}` : ''}
                  </p>
                </div>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => startEdit(p, e)}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300"
                  title="Edit preset"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePreset(p.id) }}
                  className="p-1 rounded text-zinc-500 hover:text-red-400"
                  title="Delete preset"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </button>
            {editingId === p.id && (
              <InlineForm f={editForm} setF={setEditForm} onSave={saveEdit} onCancel={cancelEdit} onPickFolder={() => handlePickFolder('edit')} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
