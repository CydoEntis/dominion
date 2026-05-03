export const kbdStyle: React.CSSProperties = {
  backgroundColor: '#1e2433',
  border: '1px solid rgba(255,255,255,0.1)',
  borderBottomColor: 'rgba(0,0,0,0.3)',
  boxShadow: '0 3px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
  borderRadius: 5,
}

interface Props {
  shortcut: string
}

export function Kbd({ shortcut }: Props): JSX.Element {
  const keys = shortcut.split('+').map((k) => k.trim())
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <kbd
          key={i}
          style={kbdStyle}
          className="inline-flex items-center px-2 h-5 text-[10px] font-mono text-zinc-300 leading-none"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
