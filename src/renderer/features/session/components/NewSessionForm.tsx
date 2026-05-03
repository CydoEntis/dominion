import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
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
import { createSession } from '../session.service'
import { useStore } from '../../../store/root.store'
import { cn } from '../../../lib/utils'

const PRESETS = [
  { id: 'shell', label: 'Shell', command: undefined },
  { id: 'claude', label: 'Claude', command: 'claude' },
  { id: 'codex', label: 'Codex', command: 'codex' },
  { id: 'gemini', label: 'Gemini', command: 'gemini' },
  { id: 'custom', label: 'Custom', command: undefined }
] as const

type PresetId = (typeof PRESETS)[number]['id']

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  preset: z.string(),
  customCommand: z.string().optional()
})

type FormData = z.infer<typeof schema>

export function NewSessionForm(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('claude')
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const handler = (): void => setOpen(true)
    document.addEventListener('acc:new-session', handler)
    return () => document.removeEventListener('acc:new-session', handler)
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', preset: 'claude', customCommand: '' }
  })

  const onSubmit = async (data: FormData): Promise<void> => {
    setLoading(true)
    try {
      const preset = PRESETS.find((p) => p.id === selectedPreset)
      const agentCommand =
        selectedPreset === 'custom'
          ? data.customCommand?.trim() || undefined
          : preset?.command

      const meta = await createSession({
        name: data.name,
        agentCommand,
        cwd: settings.projectRoot || undefined,
        cols: 80,
        rows: 24
      })
      upsertSession(meta)
      addTab(meta.sessionId)
      reset()
      setSelectedPreset('claude')
      setOpen(false)
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="New session (Ctrl+T)"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Plus size={14} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="my-agent"
              autoFocus
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Command</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    selectedPreset === preset.id
                      ? 'bg-brand-green text-brand-bg border-brand-green'
                      : 'bg-transparent text-zinc-400 border-brand-panel hover:border-brand-light hover:text-zinc-200'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedPreset === 'custom' && (
              <Input
                placeholder="e.g. aider, continue, ollama"
                {...register('customCommand')}
                className="mt-1"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 mt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Launching...' : 'Launch'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
