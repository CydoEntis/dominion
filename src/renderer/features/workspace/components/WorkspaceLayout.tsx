import { useState, useRef, useCallback } from 'react'
import { X, TerminalSquare } from 'lucide-react'
import { FileViewer } from '../../fs/components/FileViewer'
import { TabBar } from '../../../components/TabBar'
import { TerminalPane } from '../../terminal/components/TerminalPane'
import { useStore } from '../../../store/root.store'
import { cn } from '../../../lib/utils'
import type { OpenFile } from '../../session/hooks/useFileTabs'

interface Props {
  openFiles: OpenFile[]
  activeFilePath: string | null
  onActivateFile: (path: string) => void
  onCloseFile: (path: string) => void
  sessionPanelOpen: boolean
  onToggleSessionPanel: () => void
  focusedSessionId: string | null
  activeProject: string | null
}

const MIN_PANEL_HEIGHT = 120
const DEFAULT_PANEL_HEIGHT = 300
const MAX_PANEL_HEIGHT = 700

export function WorkspaceLayout({
  openFiles,
  activeFilePath,
  onActivateFile,
  onCloseFile,
  sessionPanelOpen,
  onToggleSessionPanel,
  focusedSessionId,
  activeProject,
}: Props): JSX.Element {
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT)
  const [fileViewTab, setFileViewTab] = useState<'content' | 'preview' | 'diff'>('content')
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const sessions = useStore((s) => s.sessions)
  const focusedSession = focusedSessionId ? sessions[focusedSessionId] : null

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: panelHeight }
    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      setPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, dragRef.current.startH + delta)))
    }
    const onUp = (): void => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelHeight])

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {/* File tab bar */}
      {openFiles.length > 0 && (
        <TabBar
          activity="projects"
          openFiles={openFiles}
          activeFilePath={activeFilePath}
          onActivateFile={onActivateFile}
          onCloseFile={onCloseFile}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {openFiles.length > 0 ? (
          <FileViewer
            files={openFiles}
            activeFilePath={activeFilePath}
            onActivate={onActivateFile}
            onClose={onCloseFile}
            tab={fileViewTab}
            onTabChange={setFileViewTab}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
            <TerminalSquare size={32} strokeWidth={1.5} />
            <p className="text-sm">
              {activeProject ? 'Open a file from the explorer' : 'Select a project to get started'}
            </p>
            {activeProject && !sessionPanelOpen && (
              <p className="text-xs text-zinc-600">
                Press{' '}
                <kbd className="px-1 py-0.5 bg-brand-panel rounded text-[10px]">Ctrl+J</kbd>
                {' '}to open a session
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom session panel — VS Code terminal style */}
      {sessionPanelOpen && (
        <>
          <div
            className="h-1 flex-shrink-0 bg-brand-panel hover:bg-brand-accent transition-colors cursor-row-resize"
            onMouseDown={handleDragStart}
          />

          <div
            style={{ height: panelHeight }}
            className="flex-shrink-0 flex flex-col bg-brand-surface border-t border-brand-panel/60 overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center h-8 flex-shrink-0 border-b border-brand-panel/40 px-1 gap-1 bg-brand-bg">
              {focusedSession && (
                <div className={cn(
                  'flex items-center gap-1.5 px-3 h-full text-xs text-zinc-300 border-t-2 border-t-brand-accent bg-brand-surface'
                )}>
                  <TerminalSquare size={11} className="text-zinc-400" />
                  <span>{focusedSession.name}</span>
                </div>
              )}
              <div className="flex-1" />
              <button
                onClick={onToggleSessionPanel}
                className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors rounded"
                title="Close panel (Ctrl+J)"
              >
                <X size={13} />
              </button>
            </div>

            {/* Session content */}
            <div className="flex-1 min-h-0">
              {focusedSessionId ? (
                <TerminalPane sessionId={focusedSessionId} paneItems={[]} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-700">
                  <p className="text-xs">Click a session in the sidebar to open it here</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
