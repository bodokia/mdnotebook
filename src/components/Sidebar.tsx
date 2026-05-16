import { useState, useRef, useCallback, useMemo } from 'react'
import { FileNode } from '../api'

interface Props {
  fileTree: FileNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  onCreate: (path: string) => void
  onCreateFolder: (path: string) => void
  onDelete: (path: string) => void
  onRename: (oldPath: string, newPath: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

// What we're currently creating inline
type CreatingState =
  | { type: 'file'; parentPath: string }
  | { type: 'folder'; parentPath: string }
  | null

interface NodeProps {
  node: FileNode
  selectedPath: string | null
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  onSelect: (path: string) => void
  onDelete: (path: string) => void
  onRename: (oldPath: string, newPath: string) => void
  onStartCreate: (state: CreatingState) => void
  creating: CreatingState
  onCommitCreate: (name: string) => void
  onCancelCreate: () => void
  depth: number
}

function InlineInput({
  placeholder,
  onCommit,
  onCancel,
}: {
  placeholder: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={ref}
      autoFocus
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value.trim()) onCommit(value.trim()); else onCancel() }}
      onKeyDown={e => {
        if (e.key === 'Enter' && value.trim()) onCommit(value.trim())
        if (e.key === 'Escape') onCancel()
      }}
      onClick={e => e.stopPropagation()}
      placeholder={placeholder}
      className="flex-1 text-sm bg-transparent outline-none border-b px-0.5"
      style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
    />
  )
}

function FileNodeItem({
  node,
  selectedPath,
  expandedDirs,
  onToggleDir,
  onSelect,
  onDelete,
  onRename,
  onStartCreate,
  creating,
  onCommitCreate,
  onCancelCreate,
  depth,
}: NodeProps) {
  const [hovering, setHovering] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedPath === node.path
  const indent = depth * 14
  const showActions = hovering || isSelected

  // FIX-01: long-press for mobile
  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => setHovering(true), 500)
  }, [])
  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }, [])

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRenameValue(node.name)
    setRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      const parentDir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : ''
      onRename(node.path, parentDir + trimmed)
    }
    setRenaming(false)
  }

  const isCreatingHere =
    creating?.type === 'file' && creating.parentPath === node.path && node.type === 'folder'

  return (
    <div>
      <div
        className="flex items-center group cursor-pointer select-none"
        style={{
          paddingLeft: 12 + indent,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          minHeight: 36,
          backgroundColor: isSelected ? 'var(--accent)' : hovering ? 'var(--surface)' : 'transparent',
          color: isSelected ? '#fff' : 'var(--text)',
          borderRadius: 6,
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (node.type === 'folder') onToggleDir(node.path)
          else onSelect(node.path)
        }}
      >
        {node.type === 'folder' && (
          <span className="mr-1 text-xs" style={{ color: isSelected ? '#fff' : 'var(--text-muted)', width: 12 }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
        {node.type === 'file' && <span style={{ width: 16 }} />}

        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-sm bg-transparent outline-none border-b"
            style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
          />
        ) : (
          <span className="flex-1 text-sm truncate" title={node.name}>
            {node.type === 'file' ? node.name.replace(/\.md$/, '') : node.name}
          </span>
        )}

        {/* FIX-01: show actions on hover (desktop) or selected (mobile) */}
        {!renaming && showActions && (
          <div className="flex items-center gap-0.5 ml-1 shrink-0" onClick={e => e.stopPropagation()}>
            {/* FIX-10: + button for folders */}
            {node.type === 'folder' && (
              <button
                className="text-xs px-1 rounded hover:opacity-70"
                style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 22, minHeight: 22 }}
                onClick={e => { e.stopPropagation(); onStartCreate({ type: 'file', parentPath: node.path }) }}
                title="Новая заметка в папке"
              >
                +
              </button>
            )}
            <button
              className="text-xs px-1 rounded hover:opacity-70"
              style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 22, minHeight: 22 }}
              onClick={startRename}
              title="Переименовать"
            >
              ✎
            </button>
            {node.type === 'file' && (
              <button
                className="text-xs px-1 rounded hover:opacity-70"
                style={{ color: isSelected ? '#ffaaaa' : '#f87171', minWidth: 22, minHeight: 22 }}
                onClick={e => { e.stopPropagation(); onDelete(node.path) }}
                title="Удалить"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline input for new file inside this folder (FIX-02, FIX-10) */}
      {isCreatingHere && isExpanded && (
        <div
          className="flex items-center"
          style={{ paddingLeft: 12 + indent + 14, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
        >
          <span style={{ width: 16 }} />
          <InlineInput
            placeholder="Название заметки"
            onCommit={onCommitCreate}
            onCancel={onCancelCreate}
          />
        </div>
      )}

      {node.type === 'folder' && isExpanded && (
        <>
          {node.children?.map(child => (
            <FileNodeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onStartCreate={onStartCreate}
              creating={creating}
              onCommitCreate={onCommitCreate}
              onCancelCreate={onCancelCreate}
              depth={depth + 1}
            />
          ))}
          {/* Inline input for new file in folder (when folder is not yet open) */}
          {isCreatingHere && !isExpanded && (
            <div
              className="flex items-center"
              style={{ paddingLeft: 12 + indent + 14, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
            >
              <span style={{ width: 16 }} />
              <InlineInput
                placeholder="Название заметки"
                onCommit={onCommitCreate}
                onCancel={onCancelCreate}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes
  const q = query.toLowerCase()
  return nodes.flatMap(node => {
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(q) ? [node] : []
    }
    const filteredChildren = filterTree(node.children ?? [], q)
    if (filteredChildren.length > 0) return [{ ...node, children: filteredChildren }]
    if (node.name.toLowerCase().includes(q)) return [node]
    return []
  })
}

export default function Sidebar({
  fileTree, selectedPath, onSelect, onCreate, onCreateFolder,
  onDelete, onRename, theme, onToggleTheme,
}: Props) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState<CreatingState>(null)

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const startCreateRoot = (type: 'file' | 'folder') => {
    setCreating({ type, parentPath: '' })
  }

  const commitCreate = useCallback((name: string) => {
    if (!creating) return
    const prefix = creating.parentPath ? creating.parentPath + '/' : ''
    if (creating.type === 'file') {
      const safeName = name.endsWith('.md') ? name : name + '.md'
      onCreate(prefix + safeName)
    } else {
      onCreateFolder(prefix + name)
    }
    setCreating(null)
  }, [creating, onCreate, onCreateFolder])

  const cancelCreate = useCallback(() => setCreating(null), [])

  // FIX-08: filter tree by search query
  const visibleTree = useMemo(() => filterTree(fileTree, search), [fileTree, search])

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Заметки</span>
        <div className="flex items-center gap-0.5">
          {/* FIX-11: create folder */}
          <button
            onClick={() => startCreateRoot('folder')}
            className="flex items-center justify-center rounded text-xs"
            style={{ minWidth: 30, minHeight: 30, color: 'var(--text-muted)' }}
            title="Новая папка"
          >
            □+
          </button>
          {/* FIX-02: create note with inline input */}
          <button
            onClick={() => startCreateRoot('file')}
            className="flex items-center justify-center rounded text-xl"
            style={{ minWidth: 30, minHeight: 30, color: 'var(--accent)' }}
            title="Новая заметка"
          >
            +
          </button>
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center rounded text-sm"
            style={{ minWidth: 30, minHeight: 30, color: 'var(--text-muted)' }}
            title="Сменить тему"
          >
            {theme === 'light' ? '☀︎' : '☾'}
          </button>
        </div>
      </div>

      {/* FIX-08: Search field */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск…"
          className="w-full text-sm bg-transparent outline-none rounded px-2 py-1"
          style={{
            color: 'var(--text)',
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {/* Inline input at root level */}
        {creating && creating.parentPath === '' && (
          <div className="flex items-center px-3 py-1.5">
            <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
              {creating.type === 'folder' ? '📁' : '📄'}
            </span>
            <InlineInput
              placeholder={creating.type === 'folder' ? 'Название папки' : 'Название заметки'}
              onCommit={commitCreate}
              onCancel={cancelCreate}
            />
          </div>
        )}

        {visibleTree.length === 0 && !creating ? (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Ничего не найдено' : 'Заметок пока нет'}
          </p>
        ) : (
          visibleTree.map(node => (
            <FileNodeItem
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onStartCreate={setCreating}
              creating={creating}
              onCommitCreate={commitCreate}
              onCancelCreate={cancelCreate}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  )
}
