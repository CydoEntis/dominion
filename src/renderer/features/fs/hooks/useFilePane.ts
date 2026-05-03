import { useState, useEffect, useRef } from 'react'
import { readFile, getGitDiff } from '../fs.service'
import type { BundledTheme } from 'shiki'
import type { BundledLanguage } from 'shiki'

interface OpenFile {
  path: string
  root: string
  hasChanges: boolean
}

const EXT_LANG: Record<string, BundledLanguage> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  cpp: 'cpp', c: 'c', cs: 'csharp', rb: 'ruby', php: 'php',
  html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
  yml: 'yaml', toml: 'toml', md: 'markdown', sh: 'bash', bash: 'bash',
  zsh: 'bash', ps1: 'powershell', sql: 'sql', xml: 'xml', vue: 'vue',
  svelte: 'svelte', graphql: 'graphql', dockerfile: 'dockerfile',
}

export function getLang(filePath: string): BundledLanguage {
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_LANG[ext] ?? 'text'
}

export { EXT_LANG }

let highlighterPromise: Promise<import('shiki').Highlighter> | null = null

export async function getHighlighter(themes: BundledTheme[]): Promise<import('shiki').Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes,
        langs: Object.values(EXT_LANG).filter((v, i, a) => a.indexOf(v) === i),
      })
    )
  }
  return highlighterPromise
}

export interface CtxMenu { x: number; y: number }

export interface UseFilePaneReturn {
  tab: 'content' | 'diff'
  setTab: (t: 'content' | 'diff') => void
  html: string | null
  diff: string | null
  loading: boolean
  ctxMenu: CtxMenu | null
  setCtxMenu: (m: CtxMenu | null) => void
  handleContextMenu: (e: React.MouseEvent) => void
  handleCopy: () => void
  reload: () => void
}

export function useFilePane(file: OpenFile, theme: BundledTheme, allThemes: BundledTheme[]): UseFilePaneReturn {
  const [tab, setTab] = useState<'content' | 'diff'>(file.hasChanges ? 'diff' : 'content')
  const [html, setHtml] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const mountedRef = useRef(true)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadContent = async (): Promise<void> => {
    setLoading(true)
    setHtml(null)
    const raw = await readFile(file.path)
    if (!mountedRef.current) return
    if (!raw) { setHtml(''); setLoading(false); return }
    if (raw.length > 300_000) {
      const kb = (raw.length / 1024).toFixed(0)
      setHtml(`<pre style="padding:12px;color:#a1a1aa;white-space:pre-wrap"><span style="color:#6b7280;font-size:11px">[Large file: ${kb} KB — syntax highlighting disabled]</span>\n\n${raw.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`)
      setLoading(false)
      return
    }
    try {
      const hl = await getHighlighter(allThemes)
      const lang = getLang(file.path)
      const result = hl.codeToHtml(raw, { lang, theme })
      if (mountedRef.current) setHtml(result)
    } catch {
      if (mountedRef.current) setHtml(null)
    }
    if (mountedRef.current) setLoading(false)
  }

  const loadDiff = async (): Promise<void> => {
    setLoading(true)
    const rel = file.path.replace(/\\/g, '/').replace(file.root.replace(/\\/g, '/'), '').replace(/^\//, '')
    const result = await getGitDiff(file.root, rel)
    if (mountedRef.current) { setDiff(result); setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'content') loadContent()
    else loadDiff()
  }, [file.path, tab, theme, reloadTick])

  useEffect(() => {
    setTab(file.hasChanges ? 'diff' : 'content')
  }, [file.path])

  const handleContextMenu = (e: React.MouseEvent): void => {
    const selection = window.getSelection()?.toString()
    if (!selection) return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCopy = (): void => {
    const selection = window.getSelection()?.toString() ?? ''
    if (selection) navigator.clipboard.writeText(selection)
    setCtxMenu(null)
  }

  const reload = (): void => setReloadTick((t) => t + 1)

  return { tab, setTab, html, diff, loading, ctxMenu, setCtxMenu, handleContextMenu, handleCopy, reload }
}
