import { useMarkdownPane } from '../hooks/useMarkdownPane'

interface Props {
  filePath: string
}

export function MarkdownPane({ filePath }: Props): JSX.Element {
  const { html, loading } = useMarkdownPane(filePath)

  return (
    <div className="flex-1 overflow-auto select-text cursor-text">
      {loading && <p className="text-zinc-500 text-xs px-8 py-6">Loading…</p>}
      {!loading && html === null && <p className="text-zinc-500 text-xs px-8 py-6">Unable to render preview.</p>}
      {!loading && html === '' && <p className="text-zinc-500 text-xs px-8 py-6">Empty file.</p>}
      {!loading && html && (
        <div
          className="markdown-body px-8 py-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
