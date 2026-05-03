import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../../../store/root.store'

export interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}

export interface UseFileTabsReturn {
  openFiles: OpenFile[]
  activeFilePath: string | null
  setActiveFilePath: (path: string) => void
  handleFileClick: (path: string, xy: string | undefined) => void
  handleCloseFile: (path: string) => void
}

const FILES_KEY = 'dominion:open-files'
const ACTIVE_KEY = 'dominion:active-file'

function loadFiles(): OpenFile[] {
  try {
    const raw = localStorage.getItem(FILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OpenFile[]
    // Restore without hasChanges — git status unknown at startup
    return parsed.map((f) => ({ ...f, hasChanges: false }))
  } catch {
    return []
  }
}

function loadActiveFile(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function useFileTabs(): UseFileTabsReturn {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>(loadFiles)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(loadActiveFile)

  useEffect(() => {
    try { localStorage.setItem(FILES_KEY, JSON.stringify(openFiles)) } catch {}
  }, [openFiles])

  useEffect(() => {
    try {
      if (activeFilePath) localStorage.setItem(ACTIVE_KEY, activeFilePath)
      else localStorage.removeItem(ACTIVE_KEY)
    } catch {}
  }, [activeFilePath])

  const handleFileClick = useCallback((path: string, xy: string | undefined): void => {
    const root = useStore.getState().settings.projectRoot
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev
      return [...prev, { path, root, hasChanges: xy !== undefined }]
    })
    setActiveFilePath(path)
  }, [])

  const handleCloseFile = (path: string): void => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path))
    setActiveFilePath((cur) => {
      if (cur !== path) return cur
      const remaining = openFiles.filter((f) => f.path !== path)
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null
    })
  }

  return { openFiles, activeFilePath, setActiveFilePath, handleFileClick, handleCloseFile }
}
