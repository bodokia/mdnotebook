import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from 'tiptap-markdown'
import { common, createLowlight } from 'lowlight'
import FormatToolbar from './FormatToolbar'

type EditorMode = 'wysiwyg' | 'raw'
type EditorFont = 'serif' | 'mono'

const lowlight = createLowlight(common)

interface Props {
  content: string
  onChange: (value: string) => void
  onSave: () => void
}

export default function Editor({ content, onChange, onSave }: Props) {
  const [mode, setMode] = useState<EditorMode>(
    () => (localStorage.getItem('editorMode') as EditorMode) ?? 'wysiwyg'
  )
  const [font, setFont] = useState<EditorFont>(
    () => (localStorage.getItem('editorFont') as EditorFont) ?? 'serif'
  )

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // TipTap editor — uncontrolled after mount, file switch handled by key={selectedPath} in App
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Markdown.configure({ html: false, transformPastedText: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown())
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 's') {
          event.preventDefault()
          onSave()
          return true
        }
        return false
      },
    },
    immediatelyRender: false,
  })

  const fontFamily = font === 'serif'
    ? "'Lora', Georgia, serif"
    : "'JetBrains Mono', 'Menlo', monospace"

  const toggleFont = () => {
    const next: EditorFont = font === 'serif' ? 'mono' : 'serif'
    setFont(next)
    localStorage.setItem('editorFont', next)
  }

  const toggleMode = () => {
    if (mode === 'raw' && editor) {
      // Switching to WYSIWYG: load current raw content into TipTap
      editor.commands.setContent(content as never)
    }
    const next: EditorMode = mode === 'wysiwyg' ? 'raw' : 'wysiwyg'
    setMode(next)
    localStorage.setItem('editorMode', next)
  }

  // Raw mode key handler: Cmd+S, Tab, Enter list continuation (FIX-13)
  const handleRawKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      onSave()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = content.substring(0, start) + '  ' + content.substring(end)
      onChange(next)
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2 }, 0)
      return
    }
    // FIX-13: continue list marker on Enter
    if (e.key === 'Enter') {
      const el = textareaRef.current!
      const start = el.selectionStart
      const lineStart = content.lastIndexOf('\n', start - 1) + 1
      const line = content.substring(lineStart, start)
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/)
      if (listMatch) {
        e.preventDefault()
        const [, indent, marker] = listMatch
        const nextMarker = /^\d+\./.test(marker)
          ? (parseInt(marker, 10) + 1) + '.'
          : marker
        const insert = '\n' + indent + nextMarker + ' '
        const next = content.substring(0, start) + insert + content.substring(el.selectionEnd)
        onChange(next)
        setTimeout(() => { el.selectionStart = el.selectionEnd = start + insert.length }, 0)
      }
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Editor mini-toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-1 flex-shrink-0 text-xs select-none"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <button
          onClick={toggleFont}
          className="px-2 py-0.5 rounded hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          title={font === 'serif' ? 'Переключить на моноширинный' : 'Переключить на серифный'}
        >
          {font === 'serif' ? 'Aa' : '</>'}
        </button>
        <div style={{ width: 1, height: 14, backgroundColor: 'var(--border)', margin: '0 2px' }} />
        <button
          onClick={toggleMode}
          className="px-2 py-0.5 rounded hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          title={mode === 'wysiwyg' ? 'Режим сырого Markdown' : 'Режим WYSIWYG'}
        >
          {mode === 'wysiwyg' ? 'Raw' : 'Rich'}
        </button>
      </div>

      {/* Format toolbar — only in WYSIWYG mode */}
      {mode === 'wysiwyg' && editor && (
        <FormatToolbar editor={editor} />
      )}

      {/* Content */}
      {mode === 'wysiwyg' ? (
        <div
          className="flex-1 overflow-y-auto p-6 pb-16 wysiwyg-editor"
          style={{ fontFamily }}
        >
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleRawKeyDown}
            spellCheck={false}
            className="w-full h-full resize-none outline-none bg-transparent p-6 text-sm leading-relaxed"
            style={{
              fontFamily: "'JetBrains Mono', 'Menlo', monospace",
              color: 'var(--text)',
              minHeight: '100%',
              caretColor: 'var(--accent)',
            }}
            placeholder="Начните писать…"
          />
        </div>
      )}
    </div>
  )
}
