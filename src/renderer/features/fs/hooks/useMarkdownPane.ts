import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { readFile } from '../fs.service'

export interface UseMarkdownPaneReturn {
  html: string | null
  loading: boolean
  reload: () => void
}

export function useMarkdownPane(filePath: string): UseMarkdownPaneReturn {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true)
      setHtml(null)
      const raw = await readFile(filePath)
      if (!mountedRef.current) return
      if (!raw) { setHtml(''); setLoading(false); return }
      try {
        const result = marked.parse(raw) as string
        if (mountedRef.current) setHtml(result)
      } catch {
        if (mountedRef.current) setHtml(null)
      }
      if (mountedRef.current) setLoading(false)
    }
    load()
  }, [filePath, reloadTick])

  return { html, loading, reload: () => setReloadTick((t) => t + 1) }
}
