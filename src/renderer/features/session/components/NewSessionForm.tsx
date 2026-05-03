import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FolderOpen, X } from 'lucide-react'
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
import { IPC } from '@shared/ipc-channels'
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

export function NewSessionForm({ variant = 'icon' }: { variant?: 'icon' | 'sidebar' }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('claude')
  const [selectedDir, setSelectedDir] = useState<string>('')
  const upsertSession = useStore((s) => s.upsertSession)
  const addTab = useStore((s) => s.addTab)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const handler = (): void => setOpen(true)
    document.addEventListener('acc:new-session', handler)
    return () => document.removeEventListener('acc:new-session', handler)
  }, [])

  const getDefaultDir = (_preset: PresetId): string => {
    return settings.shellStartDir || ''
  }

  const handlePresetChange = (preset: PresetId): void => {
    setSelectedPreset(preset)
    setSelectedDir(getDefaultDir(preset))
  }

  useEffect(() => {
    if (open) setSelectedDir(getDefaultDir(selectedPreset))
  }, [open])

  const pickDir = async (): Promise<void> => {
    const picked = await window.ipc.invoke(IPC.DIALOG_PICK_FOLDER) as string | null
    if (picked !== null) setSelectedDir(picked)
  }

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
        cwd: selectedDir || undefined,
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

  const dirPlaceholder = selectedPreset === 'shell' ? 'Home directory' : 'Home directory'
  const shortDir = selectedDir
    ? selectedDir.replace(/\\/g, '/').split('/').slice(-2).join('/')
    : ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'sidebar' ? (
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:bg-brand-panel hover:text-brand-light transition-colors rounded">
            <Plus size={13} /> New Session
          </button>
        ) : (
          <button
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="New session (Ctrl+T)"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Plus size={14} />
          </button>
        )}
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
                  onClick={() => handlePresetChange(preset.id)}
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

          <div className="flex flex-col gap-1.5">
            <Label>Working directory</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background text-xs text-zinc-400 min-w-0">
                {selectedDir ? (
                  <>
                    <span className="truncate flex-1" title={selectedDir}>…/{shortDir}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDir('')}
                      className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <span className="text-zinc-600">{dirPlaceholder}</span>
                )}
              </div>
              <button
                type="button"
                onClick={pickDir}
                className="flex items-center justify-center px-3 rounded border border-brand-panel bg-brand-panel hover:bg-brand-panel/60 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                title="Browse"
              >
                <FolderOpen size={14} />
              </button>
            </div>
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
