import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'

const app = express()
const PORT = 3001
const NOTES_DIR = path.resolve(process.env.NOTES_DIR ?? process.cwd())

app.use(cors())
app.use(express.json())

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

function buildTree(dir: string): FileNode[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const nodes: FileNode[] = []

  const SKIP = new Set(['node_modules', '.git', 'dist', '.cache'])

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (SKIP.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(NOTES_DIR, fullPath)

    if (entry.isDirectory()) {
      const children = buildTree(fullPath)
      if (children.length > 0) {
        nodes.push({ name: entry.name, path: relativePath, type: 'folder', children })
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      nodes.push({ name: entry.name, path: relativePath, type: 'file' })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function safePath(relativePath: string): string | null {
  const resolved = path.resolve(NOTES_DIR, relativePath)
  if (!resolved.startsWith(NOTES_DIR + path.sep) && resolved !== NOTES_DIR) return null
  return resolved
}

app.get('/api/files', (_req, res) => {
  try {
    res.json(buildTree(NOTES_DIR))
  } catch (e) {
    res.status(500).json({ error: 'Failed to read directory' })
  }
})

app.get('/api/file', (req, res) => {
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })
  const abs = safePath(rel)
  if (!abs) return res.status(403).json({ error: 'Forbidden' })
  try {
    res.send(fs.readFileSync(abs, 'utf-8'))
  } catch {
    res.status(404).json({ error: 'File not found' })
  }
})

app.post('/api/file', (req, res) => {
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })
  const abs = safePath(rel)
  if (!abs) return res.status(403).json({ error: 'Forbidden' })
  const { content } = req.body
  if (typeof content !== 'string') return res.status(400).json({ error: 'Missing content' })
  try {
    fs.writeFileSync(abs, content, 'utf-8')
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to write file' })
  }
})

app.post('/api/file/create', (req, res) => {
  const { path: rel } = req.body
  if (!rel) return res.status(400).json({ error: 'Missing path' })
  const abs = safePath(rel)
  if (!abs) return res.status(403).json({ error: 'Forbidden' })
  if (fs.existsSync(abs)) return res.status(409).json({ error: 'File already exists' })
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, '', 'utf-8')
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to create file' })
  }
})

app.delete('/api/file', (req, res) => {
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })
  const abs = safePath(rel)
  if (!abs) return res.status(403).json({ error: 'Forbidden' })
  try {
    fs.unlinkSync(abs)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

app.patch('/api/file/rename', (req, res) => {
  const { oldPath, newPath } = req.body
  if (!oldPath || !newPath) return res.status(400).json({ error: 'Missing oldPath or newPath' })
  const absOld = safePath(oldPath)
  const absNew = safePath(newPath)
  if (!absOld || !absNew) return res.status(403).json({ error: 'Forbidden' })
  try {
    fs.mkdirSync(path.dirname(absNew), { recursive: true })
    fs.renameSync(absOld, absNew)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to rename file' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Notes directory: ${NOTES_DIR}`)
})
