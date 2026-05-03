import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Settings, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { AppSettingsSchema } from '@shared/ipc-types'
import type { AppSettings } from '@shared/ipc-types'
import { IPC } from '@shared/ipc-channels'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { useStore } from '../../../store/root.store'

const HOTKEY_FIELDS: { key: keyof AppSettings['hotkeys']; label: string }[] = [
  { key: 'newSession', label: 'New Session' },
  { key: 'closeSession', label: 'Close Session' },
  { key: 'commandPalette', label: 'Command Palette' },
  { key: 'toggleDashboard', label: 'Toggle Dashboard' }
]

export function SettingsDialog(): JSX.Element {
  const [open, setOpen] = useState(false)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const { register, handleSubmit, setValue, watch } = useForm<AppSettings>({
    resolver: zodResolver(AppSettingsSchema),
    values: settings
  })

  const defaultShell = watch('defaultShell')
  const shellStartDir = watch('shellStartDir')

  const pickShell = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FILE) as string | null
    if (picked) setValue('defaultShell', picked)
  }

  const pickShellStartDir = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null
    if (picked !== null) setValue('shellStartDir', picked)
  }

  const onSubmit = async (data: AppSettings): Promise<void> => {
    await updateSettings(data)
    setOpen(false)
    toast.success('Settings saved')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          title="Settings"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Settings size={14} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex flex-col" style={{ maxHeight: '80vh' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 mt-2">
          <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-5">

            <section className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Terminal</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fontSize">Font size</Label>
                <Input id="fontSize" type="number" min={8} max={32} {...register('fontSize', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fontFamily">Font family</Label>
                <Input id="fontFamily" placeholder="monospace" {...register('fontFamily')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defaultShell">Default shell</Label>
                <div className="flex gap-2">
                  <Input
                    id="defaultShell"
                    readOnly
                    value={defaultShell ?? ''}
                    placeholder="System default"
                    className="flex-1 text-xs text-zinc-400 cursor-default"
                  />
                  <button
                    type="button"
                    onClick={pickShell}
                    className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                    title="Browse"
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shellStartDir">Shell start directory</Label>
                <div className="flex gap-2">
                  <Input
                    id="shellStartDir"
                    readOnly
                    value={shellStartDir ?? ''}
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
              {HOTKEY_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <Label className="w-36 flex-shrink-0 text-zinc-400">{label}</Label>
                  <Input
                    {...register(`hotkeys.${key}` as const)}
                    className="font-mono text-xs"
                    placeholder="Ctrl+?"
                  />
                </div>
              ))}
            </section>

            <div className="h-px bg-zinc-800" />

            <section className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Sessions</p>
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-sm text-zinc-300">Confirm before closing</span>
                <input
                  type="checkbox"
                  {...register('confirmCloseSession')}
                  className="w-4 h-4 accent-brand-green cursor-pointer"
                />
              </label>
            </section>

          </div>

          <div className="flex justify-end gap-2 pt-3 mt-2 border-t border-zinc-800 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
