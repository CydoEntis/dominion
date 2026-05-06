import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { AppSettingsSchema, DEFAULT_SETTINGS } from '@shared/ipc-types'
import type { AppSettings } from '@shared/ipc-types'
import { IPC } from '@shared/ipc-channels'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Checkbox } from '../../../components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectSeparator,
  SelectTrigger, SelectValue
} from '../../../components/ui/select'
import { useStore } from '../../../store/root.store'
import { cn } from '../../../lib/utils'

const HOTKEY_FIELDS: { key: keyof AppSettings['hotkeys']; label: string }[] = [
  { key: 'newSession',     label: 'New Session' },
  { key: 'closeSession',   label: 'Close Session' },
  { key: 'openProject',    label: 'Open Project' },
  { key: 'commandPalette', label: 'Command Palette' },
  { key: 'toggleDashboard',label: 'Toggle Dashboard' },
  { key: 'newNote',        label: 'New Note' },
  { key: 'quickNote',      label: 'Quick Note' },
]

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])

interface HotkeyInputProps {
  value: string
  onChange: (value: string) => void
}

function HotkeyInput({ value, onChange }: HotkeyInputProps): JSX.Element {
  const [capturing, setCapturing] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setCapturing(false); return }
    if (MODIFIER_KEYS.has(e.key)) return
    const modifiers: string[] = []
    if (e.ctrlKey) modifiers.push('Ctrl')
    if (e.altKey) modifiers.push('Alt')
    if (e.shiftKey) modifiers.push('Shift')
    if (e.metaKey) modifiers.push('Meta')
    if (modifiers.length === 0) return
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
    onChange([...modifiers, key].join('+'))
    setCapturing(false)
  }

  return (
    <div
      tabIndex={0}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={capturing ? handleKeyDown : undefined}
      className={cn(
        'flex items-center h-9 px-3 rounded-md border text-xs font-mono cursor-pointer select-none transition-colors outline-none flex-1',
        capturing
          ? 'border-brand-accent/60 bg-brand-accent/5 text-brand-accent'
          : 'border-input bg-background text-zinc-300 hover:border-zinc-600'
      )}
    >
      {capturing
        ? <span className="text-zinc-500">Press shortcut…</span>
        : value || <span className="text-zinc-600">—</span>
      }
    </div>
  )
}

interface ShellOption { name: string; path: string }

interface ShellSelectProps {
  value: string
  onChange: (v: string) => void
  onBrowse: () => void
}

function ShellSelect({ value, onChange, onBrowse }: ShellSelectProps): JSX.Element {
  const [detected, setDetected] = useState<ShellOption[]>([])

  useEffect(() => {
    window.ipc.invoke(IPC.FS_DETECT_SHELLS)
      .then((r) => setDetected(r as ShellOption[]))
      .catch(() => {})
  }, [])

  // Radix Select forbids empty-string values — use a sentinel for "System default"
  const SENTINEL_DEFAULT = '__default__'
  const selectValue = value === '' ? SENTINEL_DEFAULT : value

  const options = useMemo<ShellOption[]>(() => {
    const list: ShellOption[] = [{ name: 'System default', path: SENTINEL_DEFAULT }, ...detected]
    if (value && !detected.some((s) => s.path === value)) {
      list.push({ name: value.split(/[/\\]/).pop() ?? value, path: value })
    }
    return list
  }, [detected, value])

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === '__browse__') { onBrowse(); return }
        onChange(v === SENTINEL_DEFAULT ? '' : v)
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="System default" />
      </SelectTrigger>
      <SelectContent>
        {options.map(({ name, path }) => (
          <SelectItem key={path} value={path}>{name}</SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__browse__">Browse for shell…</SelectItem>
      </SelectContent>
    </Select>
  )
}

interface Props {
  onClose: () => void
}

export function SettingsForm({ onClose }: Props): JSX.Element {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const { register, handleSubmit, setValue, watch } = useForm<AppSettings>({
    resolver: zodResolver(AppSettingsSchema),
    values: settings
  })

  const defaultShell   = watch('defaultShell') ?? ''
  const shellStartDir  = watch('shellStartDir') ?? ''
  const notesDirectory = watch('notesDirectory') ?? ''
  const confirmClose      = watch('confirmCloseSession')
  const resumeOnStartup   = watch('resumeOnStartup')
  const hotkeys           = watch('hotkeys')

  const pickShell = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FILE) as string | null
    if (picked) setValue('defaultShell', picked)
  }

  const pickShellStartDir = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null
    if (picked !== null) setValue('shellStartDir', picked)
  }

  const pickNotesDir = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null
    if (picked !== null) setValue('notesDirectory', picked)
  }

  const onSubmit = async (data: AppSettings): Promise<void> => {
    await updateSettings(data)
    toast.success('Settings saved')
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pl-10 pr-16 py-8 flex flex-col gap-6">

        <section className="flex flex-col gap-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Terminal</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fontSize">Font size</Label>
              <Input id="fontSize" type="number" min={8} max={32} {...register('fontSize', { valueAsNumber: true })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fontFamily">Font family</Label>
              <Input id="fontFamily" placeholder="monospace" {...register('fontFamily')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultShell">Default shell</Label>
            <ShellSelect
              value={defaultShell}
              onChange={(v) => setValue('defaultShell', v)}
              onBrowse={pickShell}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Shell start directory</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shellStartDir}
                placeholder="Home directory"
                className="flex-1 text-xs text-zinc-400 cursor-default"
              />
              <button
                type="button"
                onClick={pickShellStartDir}
                className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                title="Browse"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
        </section>

        <div className="h-px bg-zinc-800" />

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Hotkeys</p>
          <div className="grid grid-cols-1 gap-2.5">
            {HOTKEY_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <Label className="w-40 flex-shrink-0 text-zinc-400">{label}</Label>
                <HotkeyInput
                  value={hotkeys?.[key] || DEFAULT_SETTINGS.hotkeys[key]}
                  onChange={(v) => setValue(`hotkeys.${key}` as const, v)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-zinc-800" />

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Notes</p>
          <div className="flex flex-col gap-1.5">
            <Label>Notes directory</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={notesDirectory}
                placeholder="Default (userData/notes)"
                className="flex-1 text-xs text-zinc-400 cursor-default"
              />
              <button
                type="button"
                onClick={pickNotesDir}
                className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                title="Browse"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
        </section>

        <div className="h-px bg-zinc-800" />

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Sessions</p>
          <div className="flex items-center justify-between">
            <Label htmlFor="confirm-close" className="text-sm text-zinc-300 font-normal cursor-pointer">
              Confirm before closing a session
            </Label>
            <Checkbox
              id="confirm-close"
              checked={confirmClose ?? true}
              onCheckedChange={(v) => setValue('confirmCloseSession', v === true)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="resume-on-startup" className="text-sm text-zinc-300 font-normal cursor-pointer">
                Resume on startup
              </Label>
              <span className="text-xs text-zinc-500">Re-launch agent sessions and send /resume on next app start</span>
            </div>
            <Checkbox
              id="resume-on-startup"
              checked={resumeOnStartup ?? false}
              onCheckedChange={(v) => setValue('resumeOnStartup', v === true)}
            />
          </div>
        </section>

      </div>

      {/* Sticky footer */}
      <div className="flex justify-end gap-2 pl-10 pr-16 py-4 border-t border-zinc-800 flex-shrink-0 bg-brand-bg">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30">Save</Button>
      </div>

    </form>
  )
}
