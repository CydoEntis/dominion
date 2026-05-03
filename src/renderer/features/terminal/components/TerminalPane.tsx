import { useRef } from 'react'
import { useTerminal } from '../hooks/useTerminal'

interface Props {
  sessionId: string
}

export function TerminalPane({ sessionId }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(sessionId, containerRef)

  return (
    <div
      ref={containerRef}
      className="xterm-container"
      style={{ width: '100%', height: '100%', padding: '4px 8px' }}
    />
  )
}
