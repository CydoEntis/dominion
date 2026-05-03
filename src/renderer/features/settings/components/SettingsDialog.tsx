import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Settings } from 'lucide-react'
import { AppSettingsSchema } from '@shared/ipc-types'
import type { AppSettings } from '@shared/ipc-types'
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

  const { register, handleSubmit } = useForm<AppSettings>({
    resolver: zodResolver(AppSettingsSchema),
    values: settings
  })

  const onSubmit = async (data: AppSettings): Promise<void> => {
    await updateSettings(data)
    setOpen(false)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 mt-2 max-h-[70vh] overflow-y-auto pr-1">

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
              <Input id="defaultShell" placeholder="/bin/bash" {...register('defaultShell')} />
            </div>
          </section>

          <div className="h-px bg-zinc-800" />

          <section className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Hotkeys</p>
            <p className="text-xs text-zinc-500">Format: <code className="text-zinc-300">Ctrl+T</code>, <code className="text-zinc-300">Ctrl+Shift+P</code>, etc.</p>
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

          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
