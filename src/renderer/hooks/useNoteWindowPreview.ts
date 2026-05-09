import { useState, useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { IPC } from '@shared/ipc-channels'
import type { WindowInitialNotePreviewPayload } from '@shared/ipc-types'

export function useNoteWindowPreview(): string | null {
  const [noteId, setNoteId] = useState<string | null>(null)

  useEffect(() => {
    const off = ipc.on(IPC.WINDOW_INITIAL_NOTE_PREVIEW, (payload) => {
      const { noteId: id } = payload as WindowInitialNotePreviewPayload
      setNoteId(id)
    })
    return () => off()
  }, [])

  return noteId
}
