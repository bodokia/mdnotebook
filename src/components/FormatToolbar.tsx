import type { Editor } from '@tiptap/react'
import { useState } from 'react'
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Quote, Code, Minus,
  Link as LinkIcon, Unlink,
  Undo2, Redo2,
} from 'lucide-react'

interface Props {
  editor: Editor
}

interface BtnProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}

function Btn({ onClick, active, title, children, disabled }: BtnProps) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded transition-colors flex-shrink-0"
      style={{
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        backgroundColor: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return (
    <div
      className="flex-shrink-0"
      style={{ width: 1, height: 16, backgroundColor: 'var(--border)', margin: '0 2px' }}
    />
  )
}

export default function FormatToolbar({ editor }: Props) {
  const [linkPrompt, setLinkPrompt] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const submitLink = () => {
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setLinkPrompt(false)
    setLinkUrl('')
  }

  const hasLink = editor.isActive('link')

  return (
    <div style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
      <div
        className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Undo / Redo */}
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          title="Отменить (⌘Z)"
          disabled={!editor.can().undo()}
        >
          <Undo2 size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          title="Повторить (⌘⇧Z)"
          disabled={!editor.can().redo()}
        >
          <Redo2 size={14} />
        </Btn>

        <Sep />

        {/* Headings */}
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Заголовок 1 (# )"
        >
          <Heading1 size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Заголовок 2 (## )"
        >
          <Heading2 size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Заголовок 3 (### )"
        >
          <Heading3 size={14} />
        </Btn>

        <Sep />

        {/* Inline marks */}
        <Btn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Жирный (⌘B)"
        >
          <Bold size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Курсив (⌘I)"
        >
          <Italic size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Зачёркнутый"
        >
          <Strikethrough size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Инлайн-код (`)"
        >
          <Code size={13} />
        </Btn>

        <Sep />

        {/* Lists */}
        <Btn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Маркированный список (- )"
        >
          <List size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Нумерованный список (1. )"
        >
          <ListOrdered size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Чек-лист (- [ ] )"
        >
          <ListChecks size={14} />
        </Btn>

        <Sep />

        {/* Blocks */}
        <Btn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Цитата (> )"
        >
          <Quote size={14} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Блок кода (```)"
        >
          <Code size={14} strokeWidth={1.5} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Горизонтальный разделитель (---)"
        >
          <Minus size={14} />
        </Btn>

        <Sep />

        {/* Link */}
        {hasLink ? (
          <Btn
            onClick={() => editor.chain().focus().unsetLink().run()}
            active
            title="Убрать ссылку"
          >
            <Unlink size={14} />
          </Btn>
        ) : (
          <Btn
            onClick={() => {
              const prev = editor.getAttributes('link').href as string | undefined
              setLinkUrl(prev ?? '')
              setLinkPrompt(true)
            }}
            title="Вставить ссылку (⌘K)"
          >
            <LinkIcon size={14} />
          </Btn>
        )}
      </div>

      {/* Inline link input */}
      {linkPrompt && (
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <LinkIcon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            autoFocus
            type="url"
            placeholder="https://…"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitLink()
              if (e.key === 'Escape') { setLinkPrompt(false); setLinkUrl('') }
            }}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text)' }}
          />
          <button
            onMouseDown={e => { e.preventDefault(); submitLink() }}
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            OK
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); setLinkPrompt(false); setLinkUrl('') }}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
