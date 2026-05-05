import { SessionTabBar } from '../features/session/components/SessionTabBar'
import { FileTabBar } from '../features/fs/components/FileTabBar'
import type { OpenFile } from '../features/session/hooks/useFileTabs'

interface Props {
  activity: 'sessions' | 'projects'
  openFiles: OpenFile[]
  activeFilePath: string | null
  onActivateFile: (path: string) => void
  onCloseFile: (path: string) => void
}

export function TabBar({ activity, openFiles, activeFilePath, onActivateFile, onCloseFile }: Props): JSX.Element {
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

    </div>
  )
}
