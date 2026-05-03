import { RefreshCw } from 'lucide-react'
import { SessionTabBar } from '../features/session/components/SessionTabBar'
import { FileTabBar } from '../features/fs/components/FileTabBar'
import { PresetsMenu } from '../features/settings/components/PresetsMenu'
import type { OpenFile } from '../features/session/hooks/useFileTabs'

interface Props {
  activity: 'sessions' | 'projects'
  openFiles: OpenFile[]
  activeFilePath: string | null
  onActivateFile: (path: string) => void
  onCloseFile: (path: string) => void
  onRefresh: () => void
}

export function TabBar({ activity, openFiles, activeFilePath, onActivateFile, onCloseFile, onRefresh }: Props): JSX.Element {
  return (
    <div
      className="flex items-center h-[52px] bg-brand-bg border-b border-brand-panel flex-shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Scrollable tab area */}
      <div className="flex-1 min-w-0 h-full flex items-center">
        {activity === 'sessions' ? (
          <SessionTabBar />
        ) : (
          <FileTabBar
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onActivate={onActivateFile}
            onClose={onCloseFile}
          />
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-brand-panel">
        <button
          onClick={onRefresh}
          className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-brand-panel/50 transition-colors rounded"
          title={activity === 'projects' ? 'Refresh file tree' : 'Refresh sessions'}
        >
          <RefreshCw size={12} />
        </button>
        <PresetsMenu />
      </div>
    </div>
  )
}
