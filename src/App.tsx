import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileNode, TrashItem,
  fetchFiles, fetchFileContent, saveFile, createFile, createFolder,
  renameFile, setAuthToken,
  fetchTrash, moveToTrash, restoreFromTrash, deleteFromTrash, emptyTrash,
  uploadFiles,
} from './api'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Preview from './components/Preview'
import Toast, { ToastItem } from './components/Toast'
import AuthScreen from './components/AuthScreen'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

type Theme = 'light' | 'dark'
type ViewMode = 'split' | 'editor' | 'preview'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

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
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [theme, setTheme] = useTheme()
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Auth: subscribe to session changes and keep API token in sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      setSession(s)
      setAuthToken(s?.access_token ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthToken(s?.access_token ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  const isDirty = content !== savedContent

  const addToast = useCallback((message: string) => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { id, message, duration: 3000 }])
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      const tree = await fetchFiles()
      setFileTree(tree)
    } catch (e) {
      console.error('Failed to load files', e)
    }
  }, [])

  const loadTrash = useCallback(async () => {
    try {
      const items = await fetchTrash()
      setTrashItems(items)
    } catch (e) {
      console.error('Failed to load trash', e)
    }
  }, [])

  useEffect(() => {
    if (session) {
      loadFiles()
      loadTrash()
    }
  }, [session, loadFiles, loadTrash])

  const doSave = useCallback(async (path: string, value: string) => {
    setSaveStatus('saving')
    try {
      await saveFile(path, value)
      setSavedContent(value)
      setSaveStatus('saved')
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
      savedIndicatorRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }, [])

  const openFile = useCallback(async (path: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (selectedPath && isDirty) {
      await doSave(selectedPath, content)
    }
    setLoading(true)
    try {
      const text = await fetchFileContent(path)
      setContent(text)
      setSavedContent(text)
      setSelectedPath(path)
      setSaveStatus('idle')
      setTimeout(() => { if (previewContainerRef.current) previewContainerRef.current.scrollTop = 0 }, 0)
    } finally {
      setLoading(false)
    }
    setSidebarOpen(false)
  }, [selectedPath, isDirty, content, doSave])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (selectedPath) doSave(selectedPath, value)
    }, 2000)
  }, [selectedPath, doSave])

  const handleSaveNow = useCallback(async () => {
    if (!selectedPath) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    await doSave(selectedPath, content)
  }, [selectedPath, content, doSave])

  const handleCreate = useCallback(async (path: string) => {
    await createFile(path)
    await loadFiles()
    await openFile(path)
  }, [loadFiles, openFile])

  const handleCreateFolder = useCallback(async (path: string) => {
    try {
      await createFolder(path)
      await loadFiles()
    } catch (e) {
      console.error('Failed to create folder', e)
      alert(`Не удалось создать папку: ${(e as Error).message}`)
    }
  }, [loadFiles])

  const handleDelete = useCallback(async (path: string, type: 'file' | 'folder') => {
    // Optimistically remove from UI
    setFileTree(prev => removeNodeFromTree(prev, path))
    if (selectedPath === path || (type === 'folder' && selectedPath?.startsWith(path + '/'))) {
      setSelectedPath(null)
      setContent('')
      setSavedContent('')
    }

    try {
      await moveToTrash(path, type)
      await loadTrash()
      addToast(`«${path.split('/').pop()}» перемещено в корзину`)
    } catch (e) {
      console.error('Failed to move to trash', e)
      await loadFiles() // restore UI on failure
      addToast('Не удалось переместить в корзину')
    }
  }, [selectedPath, loadFiles, loadTrash, addToast])

  const handleRename = useCallback(async (oldPath: string, newPath: string) => {
    await renameFile(oldPath, newPath)
    if (selectedPath === oldPath) setSelectedPath(newPath)
    await loadFiles()
  }, [selectedPath, loadFiles])

  const handleRestore = useCallback(async (trashId: string) => {
    try {
      await restoreFromTrash(trashId)
      await Promise.all([loadFiles(), loadTrash()])
      addToast('Восстановлено из корзины')
    } catch (e) {
      console.error('Failed to restore', e)
      addToast('Не удалось восстановить')
    }
  }, [loadFiles, loadTrash, addToast])

  const handleDeleteFromTrash = useCallback(async (trashId: string) => {
    try {
      await deleteFromTrash(trashId)
      setTrashItems(prev => prev.filter(i => i.id !== trashId))
    } catch (e) {
      console.error('Failed to delete from trash', e)
      addToast('Не удалось удалить')
    }
  }, [addToast])

  const handleUpload = useCallback(async (files: File[], folder: string) => {
    try {
      const fileData = await Promise.all(
        files.map(f => f.text().then(content => ({ name: f.name, content })))
      )
      const results = await uploadFiles(fileData, folder)
      const failed = results.filter(r => !r.ok)
      await loadFiles()
      if (failed.length === 0) {
        addToast(`Загружено: ${results.length} ${results.length === 1 ? 'файл' : 'файлов'}`)
      } else {
        addToast(`Загружено: ${results.length - failed.length}, ошибок: ${failed.length}`)
      }
    } catch (e) {
      console.error('Upload error:', e)
      addToast(`Ошибка загрузки: ${(e as Error).message}`)
    }
  }, [loadFiles, addToast])

  const handleEmptyTrash = useCallback(async () => {
    try {
      await emptyTrash()
      setTrashItems([])
    } catch (e) {
      console.error('Failed to empty trash', e)
      addToast('Не удалось очистить корзину')
    }
  }, [addToast])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const fileName = selectedPath ? selectedPath.split('/').pop() : null

  if (session === undefined) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка…</span>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  const sidebarProps = {
    fileTree,
    selectedPath,
    onSelect: openFile,
    onCreate: handleCreate,
    onCreateFolder: handleCreateFolder,
    onDelete: handleDelete,
    onRename: handleRename,
    onUpload: handleUpload,
    trashItems,
    onRestore: handleRestore,
    onDeleteFromTrash: handleDeleteFromTrash,
    onEmptyTrash: handleEmptyTrash,
    theme,
    onToggleTheme: toggleTheme,
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Sidebar — desktop always visible */}
      <div className="hidden md:flex flex-shrink-0" style={{ width: 260, borderRight: '1px solid var(--border)' }}>
        <Sidebar {...sidebarProps} />
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
            <Sidebar {...sidebarProps} />
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

          <div className="flex-1 min-w-0 flex items-center gap-2">
            {fileName && (
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                {fileName.replace(/\.md$/, '')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs font-medium" style={{ color: '#f87171' }}>
                ⚠ Ошибка сохранения
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ✓ Сохранено
              </span>
            )}
            {saveStatus === 'idle' && isDirty && (
              <span className="text-xs" style={{ color: 'var(--accent)' }}>●</span>
            )}
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="hidden md:flex items-center px-2 py-1 rounded text-xs"
            style={{ color: 'var(--text-muted)' }}
            title="Выйти"
          >
            Выйти
          </button>

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
                {mode === 'editor' ? 'Редактор' : mode === 'split' ? 'Сплит' : 'Просмотр'}
              </button>
            ))}
          </div>

          <div className="flex md:hidden items-center gap-1">
            {(['editor', 'preview'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 rounded text-xs font-medium"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
                  color: viewMode === mode ? '#fff' : 'var(--text-muted)',
                }}
              >
                {mode === 'editor' ? 'Ред.' : 'Пред.'}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {!selectedPath ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Выберите заметку или создайте новую
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Загрузка…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {(viewMode === 'editor' || viewMode === 'split') && (
              <div
                className="flex-1 min-w-0 overflow-hidden"
                style={{ borderRight: viewMode === 'split' ? '1px solid var(--border)' : undefined }}
              >
                <Editor
                  key={selectedPath}
                  content={content}
                  onChange={handleContentChange}
                  onSave={handleSaveNow}
                />
              </div>
            )}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div ref={previewContainerRef} className="flex-1 min-w-0 overflow-y-auto">
                <Preview content={content} theme={theme} />
              </div>
            )}
          </div>
        )}
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function removeNodeFromTree(nodes: FileNode[], path: string): FileNode[] {
  return nodes.flatMap(node => {
    if (node.path === path) return []
    if (node.type === 'folder' && node.children) {
      return [{ ...node, children: removeNodeFromTree(node.children, path) }]
    }
    return [node]
  })
}
