import { useEffect, useRef } from 'react'

interface Props {
  content: string
  onChange: (value: string) => void
  onSave: () => void
}

export default function Editor({ content, onChange, onSave }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => { resize() }, [content])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      onSave()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = ref.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal = content.substring(0, start) + '  ' + content.substring(end)
      onChange(newVal)
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 2
      }, 0)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      <textarea
        ref={ref}
        value={content}
        onChange={e => { onChange(e.target.value); resize() }}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full resize-none outline-none bg-transparent p-6 text-sm leading-relaxed"
        style={{
          fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          color: 'var(--text)',
          minHeight: '100%',
          caretColor: 'var(--accent)',
        }}
        placeholder="Start writing…"
      />
    </div>
  )
}
