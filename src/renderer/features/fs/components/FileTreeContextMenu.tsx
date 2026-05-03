import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Eye, FolderOpen, Copy, ExternalLink } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { showInFolder, openPath, openInEditor } from '../fs.service'
import type { FsEntry } from '@shared/ipc-types'
import type { InstalledEditor } from '../hooks/useInstalledEditors'

interface Props {
  x: number
  y: number
  entry: FsEntry
  projectRoot: string
  rel: string
  editors: InstalledEditor[]
  onFileClick: (path: string, xy: string | undefined) => void
  onDismiss: () => void
}

function Item({ icon, label, onClick, className }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-brand-panel hover:text-zinc-100 transition-colors text-left',
        className
      )}
    >
      <span className="w-3.5 flex-shrink-0 flex items-center">{icon}</span>
      {label}
    </button>
  )
}

function Divider(): JSX.Element {
  return <div className="h-px bg-brand-panel my-1" />
}

export function FileTreeContextMenu({ x, y, entry, projectRoot, rel, editors, onFileClick, onDismiss }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const isMd = entry.name.toLowerCase().endsWith('.md')

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      onDismiss()
    }
    document.addEventListener('mousedown', handler, { capture: true })
    document.addEventListener('contextmenu', handler, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handler, { capture: true })
      document.removeEventListener('contextmenu', handler, { capture: true })
    }
  }, [onDismiss])

  const adjustedX = Math.min(x, window.innerWidth - 220)
  const adjustedY = Math.min(y, window.innerHeight - 300)

  const dismiss = (fn: () => void) => () => { fn(); onDismiss() }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: adjustedY, left: adjustedX, zIndex: 9999 }}
      className="bg-brand-surface border border-brand-panel/60 rounded-md shadow-2xl py-1 w-52"
      onContextMenu={(e) => e.preventDefault()}
    >
      {!entry.isDirectory && isMd && (
        <>
          <Item
            icon={<Eye size={12} />}
            label="Preview"
            onClick={dismiss(() => onFileClick(entry.path, undefined))}
          />
          <Divider />
        </>
      )}

      <Item
        icon={<ExternalLink size={12} />}
        label="Open"
        onClick={dismiss(() => openPath(entry.path))}
      />

      {editors.map((ed) => (
        <Item
          key={ed.command}
          icon={<ExternalLink size={12} />}
          label={`Open in ${ed.name}`}
          onClick={dismiss(() => openInEditor(ed.command, entry.path))}
        />
      ))}

      <Divider />

      <Item
        icon={<Copy size={12} />}
        label="Copy Relative Path"
        onClick={dismiss(() => navigator.clipboard.writeText(rel))}
      />
      <Item
        icon={<Copy size={12} />}
        label="Copy Absolute Path"
        onClick={dismiss(() => navigator.clipboard.writeText(entry.path))}
      />

      <Divider />

      <Item
        icon={<FolderOpen size={12} />}
        label="Reveal in Explorer"
        onClick={dismiss(() => showInFolder(entry.path))}
      />
    </div>,
    document.body
  )
}
