import express from 'express'
import cors from 'cors'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'

const app = express()
const PORT = 3001
const BUCKET = 'notes'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

app.use(cors())
app.use(express.json())

interface AuthedRequest extends Request {
  userId: string
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  ;(req as AuthedRequest).userId = user.id
  next()
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

function storageKey(userId: string, relativePath: string): string {
  return `${userId}/${relativePath}`
}

// Recursive listing: each folder requires a separate list() call (S3 limitation)
async function listRecursive(userId: string, prefix: string = ''): Promise<FileNode[]> {
  const listPath = prefix ? `${userId}/${prefix}` : userId

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(listPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error || !data) return []

  const nodes: FileNode[] = []

  for (const item of data) {
    if (item.name === '.keep') continue

    const relativePath = prefix ? `${prefix}/${item.name}` : item.name

    if (item.id === null) {
      // Virtual folder — include even if empty (only .keep inside)
      const children = await listRecursive(userId, relativePath)
      nodes.push({ name: item.name, path: relativePath, type: 'folder', children })
    } else if (item.name.endsWith('.md')) {
      nodes.push({ name: item.name, path: relativePath, type: 'file' })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

app.get('/api/files', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const tree = await listRecursive(userId)
  res.json(tree)
})

app.get('/api/file', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storageKey(userId, rel))

  if (error || !data) return res.status(404).json({ error: 'File not found' })
  res.send(await data.text())
})

app.post('/api/file', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })

  const { content } = req.body
  if (typeof content !== 'string') return res.status(400).json({ error: 'Missing content' })

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey(userId, rel), content, {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

  if (error) return res.status(500).json({ error: 'Failed to save file' })
  res.json({ ok: true })
})

app.post('/api/file/create', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { path: rel } = req.body
  if (!rel) return res.status(400).json({ error: 'Missing path' })

  const key = storageKey(userId, rel)

  // Check if file already exists
  const dirPath = key.split('/').slice(0, -1).join('/')
  const fileName = key.split('/').pop()!
  const { data: existing } = await supabase.storage.from(BUCKET).list(dirPath)
  if (existing?.some(f => f.name === fileName)) {
    return res.status(409).json({ error: 'File already exists' })
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, '', { contentType: 'text/markdown; charset=utf-8' })

  if (error) return res.status(500).json({ error: 'Failed to create file' })
  res.json({ ok: true })
})

app.post('/api/folder/create', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { path: rel } = req.body
  if (!rel) return res.status(400).json({ error: 'Missing path' })

  // S3 has no real folders — upload a .keep placeholder to materialise the prefix
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey(userId, `${rel}/.keep`), '', { contentType: 'text/plain' })

  if (error) return res.status(500).json({ error: 'Failed to create folder' })
  res.json({ ok: true })
})

app.delete('/api/file', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const rel = req.query.path as string
  if (!rel) return res.status(400).json({ error: 'Missing path' })

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storageKey(userId, rel)])

  if (error) return res.status(500).json({ error: 'Failed to delete file' })
  res.json({ ok: true })
})

app.patch('/api/file/rename', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { oldPath, newPath } = req.body
  if (!oldPath || !newPath) return res.status(400).json({ error: 'Missing paths' })

  const oldKey = storageKey(userId, oldPath)
  const newKey = storageKey(userId, newPath)

  const { error: copyError } = await supabase.storage.from(BUCKET).copy(oldKey, newKey)
  if (copyError) return res.status(500).json({ error: 'Failed to rename file' })

  await supabase.storage.from(BUCKET).remove([oldKey])
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
