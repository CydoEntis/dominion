import { useStore } from '../../../store/root.store'
import { SessionTab } from './SessionTab'
import { NewSessionForm } from './NewSessionForm'

export function SessionTabBar(): JSX.Element {
  const tabOrder = useStore((s) => s.tabOrder)
  const sessions = useStore((s) => s.sessions)
  const activeSessionId = useStore((s) => s.activeSessionId)
  const setActiveSession = useStore((s) => s.setActiveSession)

  return (
    <div
      className="flex items-center h-full overflow-x-auto scrollbar-none gap-0 flex-1 min-w-0"
    >
      {tabOrder.map((sessionId) => {
        const meta = sessions[sessionId]
        if (!meta) return null
        return (
          <SessionTab
            key={sessionId}
            meta={meta}
            isActive={activeSessionId === sessionId}
            onActivate={() => setActiveSession(sessionId)}
          />
        )
      })}
      <div className="flex items-center px-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <NewSessionForm />
      </div>
    </div>
  )
}
