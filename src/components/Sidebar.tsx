import { useState, useRef } from 'react'
import { FileNode } from '../api'

interface Props {
  fileTree: FileNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  onCreate: (path: string) => void
  onDelete: (path: string) => void
  onRename: (oldPath: string, newPath: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

interface NodeProps {
  node: FileNode
  selectedPath: string | null
  expandedDirs: Set<string>
  onToggleDir: (path: string) => void
  onSelect: (path: string) => void
  onDelete: (path: string) => void
  onRename: (oldPath: string, newPath: string) => void
  depth: number
}

function FileNodeItem({ node, selectedPath, expandedDirs, onToggleDir, onSelect, onDelete, onRename, depth }: NodeProps) {
  const [hovering, setHovering] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedPath === node.path
  const indent = depth * 12

  const startRename = () => {
    setRenameValue(node.name)
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.name) {
      const parentDir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/') + 1) : ''
      const newPath = parentDir + trimmed
      onRename(node.path, newPath)
    }
    setRenaming(false)
  }

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
            ref={inputRef}
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

        {!renaming && hovering && node.type === 'file' && (
          <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
            <button
              className="text-xs px-1 rounded hover:opacity-70"
              style={{ color: isSelected ? '#fff' : 'var(--text-muted)', minWidth: 20, minHeight: 20 }}
              onClick={startRename}
              title="Rename"
            >
              ✎
            </button>
            <button
              className="text-xs px-1 rounded hover:opacity-70"
              style={{ color: isSelected ? '#ffaaaa' : '#f87171', minWidth: 20, minHeight: 20 }}
              onClick={() => {
                if (confirm(`Delete "${node.name}"?`)) onDelete(node.path)
              }}
              title="Delete"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {node.type === 'folder' && isExpanded && node.children?.map(child => (
        <FileNodeItem
          key={child.path}
          node={child}
          selectedPath={selectedPath}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export default function Sidebar({ fileTree, selectedPath, onSelect, onCreate, onDelete, onRename, theme, onToggleTheme }: Props) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleCreate = () => {
    const name = prompt('Note name:')
    if (!name) return
    const safeName = name.endsWith('.md') ? name : name + '.md'
    onCreate(safeName)
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Notes</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreate}
            className="flex items-center justify-center rounded text-lg"
            style={{ minWidth: 32, minHeight: 32, color: 'var(--accent)' }}
            title="New note"
          >
            +
          </button>
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center rounded text-sm"
            style={{ minWidth: 32, minHeight: 32, color: 'var(--text-muted)' }}
            title="Toggle theme"
          >
            {theme === 'light' ? '☀︎' : '☾'}
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {fileTree.length === 0 ? (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--text-muted)' }}>No notes yet</p>
        ) : (
          fileTree.map(node => (
            <FileNodeItem
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  )
}
