import { useState, useEffect } from 'react'
import { detectEditors } from '../fs.service'

export interface InstalledEditor {
  name: string
  command: string
}

export function useInstalledEditors(): InstalledEditor[] {
  const [editors, setEditors] = useState<InstalledEditor[]>([])
  useEffect(() => {
    detectEditors().then(setEditors).catch(() => {})
  }, [])
  return editors
}
