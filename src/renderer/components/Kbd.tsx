export const kbdStyle: React.CSSProperties = {
  background: 'rgb(var(--brand-panel))',
  border: '1px solid rgb(var(--brand-accent) / 0.14)',
  borderBottomColor: 'rgba(0,0,0,0.25)',
  boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgb(var(--brand-accent) / 0.07)',
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
