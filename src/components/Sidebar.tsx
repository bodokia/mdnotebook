import { useState, useRef, useCallback, useMemo, useId } from 'react'
import { FileNode, TrashItem } from '../api'

interface Props {
  fileTree: FileNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  onCreate: (path: string) => void
  onCreateFolder: (path: string) => void
  onDelete: (path: string, type: 'file' | 'folder') => void
  onRename: (oldPath: string, newPath: string) => void
  onUpload: (files: File[], folder: string) => void
  trashItems: TrashItem[]
  onRestore: (trashId: string) => void
  onDeleteFromTrash: (trashId: string) => void
  onEmptyTrash: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

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
  onDelete: (path: string, type: 'file' | 'folder') => void
  onRename: (oldPath: string, newPath: string) => void
  onStartCreate: (state: CreatingState) => void
  onStartUpload: (folderPath: string) => void
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
  onStartUpload,
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

        {!renaming && showActions && (
          <div className="flex items-center gap-0.5 ml-1 shrink-0" onClick={e => e.stopPropagation()}>
            {node.type === 'folder' && (
              <>
                <button
                  className="text-xs px-1 rounded hover:opacity-70"
                  style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 22, minHeight: 22 }}
                  onClick={e => { e.stopPropagation(); onStartCreate({ type: 'file', parentPath: node.path }) }}
                  title="Новая заметка в папке"
                >
                  +
                </button>
                <button
                  className="text-xs px-1 rounded hover:opacity-70"
                  style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 22, minHeight: 22 }}
                  onClick={e => { e.stopPropagation(); onStartUpload(node.path) }}
                  title="Загрузить файлы в папку"
                >
                  ↑
                </button>
              </>
            )}
            <button
              className="text-xs px-1 rounded hover:opacity-70"
              style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 22, minHeight: 22 }}
              onClick={startRename}
              title="Переименовать"
            >
              ✎
            </button>
            <button
              className="text-xs px-1 rounded hover:opacity-70"
              style={{ color: isSelected ? '#ffaaaa' : '#f87171', minWidth: 22, minHeight: 22 }}
              onClick={e => { e.stopPropagation(); onDelete(node.path, node.type) }}
              title="В корзину"
            >
              ✕
            </button>
          </div>
        )}
      </div>

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
              onStartUpload={onStartUpload}
              creating={creating}
              onCommitCreate={onCommitCreate}
              onCancelCreate={onCancelCreate}
              depth={depth + 1}
            />
          ))}
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

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  return `${days} дн. назад`
}

export default function Sidebar({
  fileTree, selectedPath, onSelect, onCreate, onCreateFolder,
  onDelete, onRename, onUpload,
  trashItems, onRestore, onDeleteFromTrash, onEmptyTrash,
  theme, onToggleTheme,
}: Props) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState<CreatingState>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadFolderRef = useRef<string>('')
  const uploadInputId = useId()

  const startUpload = useCallback((folderPath: string) => {
    uploadFolderRef.current = folderPath
    uploadInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      onUpload(files, uploadFolderRef.current)
    }
    e.target.value = ''
  }, [onUpload])

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

  const visibleTree = useMemo(() => filterTree(fileTree, search), [fileTree, search])

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Hidden file input for upload */}
      <input
        id={uploadInputId}
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Заметки</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => startUpload('')}
            className="flex items-center justify-center rounded text-sm"
            style={{ minWidth: 30, minHeight: 30, color: 'var(--text-muted)' }}
            title="Загрузить файлы"
          >
            ↑
          </button>
          <button
            onClick={() => startCreateRoot('folder')}
            className="flex items-center justify-center rounded text-xs"
            style={{ minWidth: 30, minHeight: 30, color: 'var(--text-muted)' }}
            title="Новая папка"
          >
            □+
          </button>
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

      {/* Search */}
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
              onStartUpload={startUpload}
              creating={creating}
              onCommitCreate={commitCreate}
              onCancelCreate={cancelCreate}
              depth={0}
            />
          ))
        )}
      </div>

      {/* Trash section */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div
          className="flex items-center justify-between px-3 cursor-pointer select-none"
          style={{ paddingTop: 8, paddingBottom: 8 }}
          onClick={() => setTrashOpen(v => !v)}
        >
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span>{trashOpen ? '▾' : '▸'}</span>
            <span>Корзина{trashItems.length > 0 ? ` (${trashItems.length})` : ''}</span>
          </span>
          {trashItems.length > 0 && (
            <button
              className="text-xs px-1.5 py-0.5 rounded hover:opacity-70"
              style={{ color: '#f87171' }}
              title="Очистить корзину"
              onClick={e => { e.stopPropagation(); onEmptyTrash() }}
            >
              Очистить
            </button>
          )}
        </div>

        {trashOpen && (
          <div className="pb-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {trashItems.length === 0 ? (
              <p className="text-xs px-4 py-1" style={{ color: 'var(--text-muted)' }}>
                Корзина пуста
              </p>
            ) : (
              trashItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded mx-1"
                  style={{ minHeight: 36 }}
                >
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {item.type === 'folder' ? '📁' : '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs truncate"
                      style={{ color: 'var(--text)' }}
                      title={item.name.replace(/\.md$/, '')}
                    >
                      {item.name.replace(/\.md$/, '')}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {formatRelativeDate(item.deletedAt)}
                    </div>
                  </div>
                  <button
                    className="text-xs px-1 rounded hover:opacity-70 shrink-0"
                    style={{ color: 'var(--accent)', minWidth: 22, minHeight: 22 }}
                    title="Восстановить"
                    onClick={() => onRestore(item.id)}
                  >
                    ↩
                  </button>
                  <button
                    className="text-xs px-1 rounded hover:opacity-70 shrink-0"
                    style={{ color: '#f87171', minWidth: 22, minHeight: 22 }}
                    title="Удалить навсегда"
                    onClick={() => onDeleteFromTrash(item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
