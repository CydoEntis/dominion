import { useState, useCallback } from 'react'
import { useStore } from '../../../store/root.store'

interface OpenFile {
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

export function useFileTabs(): UseFileTabsReturn {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

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
