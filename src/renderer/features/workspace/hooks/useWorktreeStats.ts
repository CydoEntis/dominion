import { useState, useEffect } from 'react'
import type { SessionMeta } from '@shared/ipc-types'
import { getWorktreeStats } from '../../fs/fs.service'
import type { WorktreeStats } from '../../fs/fs.service'

export function useWorktreeStats(sessions: SessionMeta[]): Record<string, WorktreeStats> {
  const [stats, setStats] = useState<Record<string, WorktreeStats>>({})

  const key = sessions.map((s) => `${s.sessionId}:${s.worktreePath ?? ''}`).join('|')

  useEffect(() => {
    const worktreeSessions = sessions.filter((s) => s.worktreePath && s.worktreeBaseBranch)
    if (worktreeSessions.length === 0) return

    const fetchAll = async (): Promise<void> => {
      const results = await Promise.allSettled(
        worktreeSessions.map((s) => getWorktreeStats(s.worktreePath!, s.worktreeBaseBranch!))
      )
      setStats((prev) => {
        const next = { ...prev }
        worktreeSessions.forEach((s, i) => {
          const r = results[i]
          if (r.status === 'fulfilled') next[s.sessionId] = r.value
        })
        return next
      })
    }

    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => clearInterval(id)
  }, [key])

  return stats
}
