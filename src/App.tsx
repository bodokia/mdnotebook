import { useState, useEffect, useCallback, useRef } from 'react'
import { FileNode, fetchFiles, fetchFileContent, saveFile, createFile, deleteFile, renameFile } from './api'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Preview from './components/Preview'

type Theme = 'light' | 'dark'
type ViewMode = 'split' | 'editor' | 'preview'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return [theme, setTheme] as const
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [loading, setLoading] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = content !== savedContent

  const loadFiles = useCallback(async () => {
    try {
      const tree = await fetchFiles()
      setFileTree(tree)
    } catch (e) {
      console.error('Failed to load files', e)
    }
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  const openFile = useCallback(async (path: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (selectedPath && isDirty) {
      await saveFile(selectedPath, content)
    }
    setLoading(true)
    try {
      const text = await fetchFileContent(path)
      setContent(text)
      setSavedContent(text)
      setSelectedPath(path)
    } finally {
      setLoading(false)
    }
    setSidebarOpen(false)
  }, [selectedPath, isDirty, content])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (selectedPath) {
        await saveFile(selectedPath, value)
        setSavedContent(value)
      }
    }, 2000)
  }, [selectedPath])

  const handleSaveNow = useCallback(async () => {
    if (!selectedPath) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    await saveFile(selectedPath, content)
    setSavedContent(content)
  }, [selectedPath, content])

  const handleCreate = useCallback(async (path: string) => {
    await createFile(path)
    await loadFiles()
    await openFile(path)
  }, [loadFiles, openFile])

  const handleDelete = useCallback(async (path: string) => {
    await deleteFile(path)
    if (selectedPath === path) {
      setSelectedPath(null)
      setContent('')
      setSavedContent('')
    }
    await loadFiles()
  }, [selectedPath, loadFiles])

  const handleRename = useCallback(async (oldPath: string, newPath: string) => {
    await renameFile(oldPath, newPath)
    if (selectedPath === oldPath) setSelectedPath(newPath)
    await loadFiles()
  }, [selectedPath, loadFiles])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const fileName = selectedPath ? selectedPath.split('/').pop() : null

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Sidebar — desktop always visible, mobile as drawer */}
      <div className="hidden md:flex flex-shrink-0" style={{ width: 260, borderRight: '1px solid var(--border)' }}>
        <Sidebar
          fileTree={fileTree}
          selectedPath={selectedPath}
          onSelect={openFile}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onRename={handleRename}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden" style={{ width: 280 }}>
            <Sidebar
              fileTree={fileTree}
              selectedPath={selectedPath}
              onSelect={openFile}
              onCreate={handleCreate}
              onDelete={handleDelete}
              onRename={handleRename}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <button
            className="md:hidden flex items-center justify-center rounded"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--text-muted)' }}
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex-1 min-w-0">
            {fileName && (
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {fileName.replace(/\.md$/, '')}
                {isDirty && <span className="ml-1 text-xs" style={{ color: 'var(--accent)' }}>●</span>}
              </span>
            )}
          </div>

          {/* View mode — split only on desktop */}
          <div className="hidden md:flex items-center gap-1">
            {(['editor', 'split', 'preview'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
                  color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                }}
              >
                {mode === 'editor' ? 'Edit' : mode === 'split' ? 'Split' : 'Preview'}
              </button>
            ))}
          </div>

          {/* View mode — mobile: editor / preview only */}
          <div className="flex md:hidden items-center gap-1">
            {(['editor', 'preview'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
                  color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                }}
              >
                {mode === 'editor' ? 'Edit' : 'Preview'}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {!selectedPath ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a note or create a new one
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {(viewMode === 'editor' || viewMode === 'split') && (
              <div className="flex-1 min-w-0 overflow-hidden" style={{ borderRight: viewMode === 'split' ? '1px solid var(--border)' : undefined }}>
                <Editor
                  content={content}
                  onChange={handleContentChange}
                  onSave={handleSaveNow}
                />
              </div>
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex-1 min-w-0 overflow-y-auto">
                <Preview content={content} theme={theme} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
