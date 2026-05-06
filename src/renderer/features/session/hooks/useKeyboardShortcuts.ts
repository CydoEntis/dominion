import { useEffect, useRef } from 'react'
import { useStore } from '../../../store/root.store'
import { killSession } from '../session.service'

interface Callbacks {
  onTogglePalette: () => void
  onFileSearch: () => void
  onShowShortcuts: () => void
  onNewNote: () => void
  onNewNoteDrawer: () => void
}

function match(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+').map((p) => p.trim())
  const key = parts[parts.length - 1]
  const needsCtrl = parts.includes('ctrl')
  const needsShift = parts.includes('shift')
  const needsAlt = parts.includes('alt')
  const hasExplicitMods = needsCtrl || needsShift || needsAlt
  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt &&
    (hasExplicitMods ? e.shiftKey === needsShift : !e.ctrlKey && !e.altKey)
  )
}

export function useKeyboardShortcuts({ onTogglePalette, onFileSearch, onShowShortcuts, onNewNote, onNewNoteDrawer }: Callbacks): void {
  const removeTab = useStore((s) => s.removeTab)
  const settings = useStore((s) => s.settings)
  const activeSessionId = useStore((s) => s.activeSessionId)

  const settingsRef = useRef(settings)
  const activeSessionIdRef = useRef(activeSessionId)
  const onTogglePaletteRef = useRef(onTogglePalette)
  const onFileSearchRef = useRef(onFileSearch)
  const onShowShortcutsRef = useRef(onShowShortcuts)
  const onNewNoteRef = useRef(onNewNote)
  const onNewNoteDrawerRef = useRef(onNewNoteDrawer)

  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { activeSessionIdRef.current = activeSessionId }, [activeSessionId])
  useEffect(() => { onTogglePaletteRef.current = onTogglePalette }, [onTogglePalette])
  useEffect(() => { onFileSearchRef.current = onFileSearch }, [onFileSearch])
  useEffect(() => { onShowShortcutsRef.current = onShowShortcuts }, [onShowShortcuts])
  useEffect(() => { onNewNoteRef.current = onNewNote }, [onNewNote])
  useEffect(() => { onNewNoteDrawerRef.current = onNewNoteDrawer }, [onNewNoteDrawer])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const hk = settingsRef.current.hotkeys

      if (match(e, hk.quickNote)) {
        e.preventDefault(); e.stopPropagation()
        onNewNoteDrawerRef.current()
      } else if (match(e, hk.newNote)) {
        e.preventDefault(); e.stopPropagation()
        onNewNoteRef.current()
      } else if (match(e, hk.newSession)) {
        e.preventDefault(); e.stopPropagation()
        document.dispatchEvent(new CustomEvent('acc:new-session'))
      } else if (match(e, hk.openProject)) {
        e.preventDefault(); e.stopPropagation()
        document.dispatchEvent(new CustomEvent('acc:open-project'))
      } else if (match(e, hk.closeSession)) {
        e.preventDefault(); e.stopPropagation()
        const sid = activeSessionIdRef.current
        if (sid) { killSession(sid); removeTab(sid) }
      } else if (match(e, hk.commandPalette)) {
        e.preventDefault(); e.stopPropagation()
        onTogglePaletteRef.current()
      } else if (match(e, hk.fileSearch)) {
        e.preventDefault(); e.stopPropagation()
        onFileSearchRef.current()
      } else if (match(e, hk.showShortcuts)) {
        e.preventDefault(); e.stopPropagation()
        onShowShortcutsRef.current()
      } else if (match(e, hk.toggleDashboard)) {
        e.preventDefault(); e.stopPropagation()
        useStore.getState().toggleDashboard()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [removeTab])
}
