import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { getGitReview, stageFile, stageAll, unstageFile, unstageAll, gitCommit, gitPush, getGitBranchInfo, getGitLog } from '../../fs/fs.service'
import type { GitReviewData, GitCommit } from '../../fs/fs.service'

export interface UseGitReviewReturn {
  data: GitReviewData | null
  currentBranch: string | null
  commits: GitCommit[]
  loading: boolean
  committing: boolean
  pushing: boolean
  commitMessage: string
  setCommitMessage: (msg: string) => void
  stage: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  unstage: (path: string) => Promise<void>
  unstageAll: () => Promise<void>
  commit: () => Promise<void>
  push: () => Promise<void>
  refresh: () => void
}

export function useGitReview(projectRoot: string | null, baseBranch?: string | null): UseGitReviewReturn {
  const [data, setData] = useState<GitReviewData | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [tick, setTick] = useState(0)
  const rootRef = useRef(projectRoot)
  useEffect(() => { rootRef.current = projectRoot }, [projectRoot])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!projectRoot) { setData(null); setCurrentBranch(null); setCommits([]); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      getGitReview(projectRoot),
      getGitBranchInfo(projectRoot),
      getGitLog(projectRoot, baseBranch ?? undefined, 20),
    ]).then(([review, branch, log]) => {
      if (cancelled) return
      setData(review)
      setCurrentBranch(branch.current)
      setCommits(log)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectRoot, baseBranch, tick])

  useEffect(() => {
    if (!projectRoot) return
    const id = setInterval(() => setTick((t) => t + 1), 4000)
    return () => clearInterval(id)
  }, [projectRoot])

  const stage = useCallback(async (filePath: string) => {
    if (!rootRef.current) return
    try { await stageFile(rootRef.current, filePath); refresh() }
    catch (err) { toast.error(`Stage failed: ${err instanceof Error ? err.message : String(err)}`) }
  }, [refresh])

  const stageAllFn = useCallback(async () => {
    if (!rootRef.current) return
    try { await stageAll(rootRef.current); refresh() }
    catch (err) { toast.error(`Stage all failed: ${err instanceof Error ? err.message : String(err)}`) }
  }, [refresh])

  const unstage = useCallback(async (filePath: string) => {
    if (!rootRef.current) return
    try { await unstageFile(rootRef.current, filePath); refresh() }
    catch (err) { toast.error(`Unstage failed: ${err instanceof Error ? err.message : String(err)}`) }
  }, [refresh])

  const unstageAllFn = useCallback(async () => {
    if (!rootRef.current) return
    try { await unstageAll(rootRef.current); refresh() }
    catch (err) { toast.error(`Unstage all failed: ${err instanceof Error ? err.message : String(err)}`) }
  }, [refresh])

  const commit = useCallback(async () => {
    if (!rootRef.current || !commitMessage.trim()) return
    setCommitting(true)
    try {
      const result = await gitCommit(rootRef.current, commitMessage.trim())
      if (result.success) { setCommitMessage(''); refresh(); toast.success('Committed successfully') }
      else { toast.error(`Commit failed: ${result.error ?? 'unknown error'}`) }
    } catch (err) {
      toast.error(`Commit failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setCommitting(false) }
  }, [commitMessage, refresh])

  const push = useCallback(async () => {
    if (!rootRef.current) return
    setPushing(true)
    try {
      const result = await gitPush(rootRef.current)
      if (result.success) { toast.success('Pushed successfully') }
      else { toast.error(`Push failed: ${result.error ?? 'unknown error'}`) }
    } catch (err) {
      toast.error(`Push failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setPushing(false) }
  }, [])

  return {
    data, currentBranch, commits, loading, committing, pushing,
    commitMessage, setCommitMessage,
    stage, stageAll: stageAllFn, unstage, unstageAll: unstageAllFn,
    commit, push, refresh,
  }
}
