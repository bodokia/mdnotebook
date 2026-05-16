import express from 'express'
import cors from 'cors'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

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
app.use(express.json({ limit: '10mb' }))

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

export interface TrashEntry {
  id: string
  originalPath: string
  name: string
  type: 'file' | 'folder'
  deletedAt: string
}

type TrashIndex = Record<string, Omit<TrashEntry, 'id'>>

function storageKey(userId: string, relativePath: string): string {
  return `${userId}/${relativePath}`
}

// Flat recursive list of all file paths (relative, without userId) under a prefix
async function listAllFilesFlat(userId: string, prefix: string): Promise<string[]> {
  const listPath = `${userId}/${prefix}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(listPath, { limit: 1000 })

  if (error || !data) return []

  const files: string[] = []
  for (const item of data) {
    const relPath = `${prefix}/${item.name}`
    if (item.id === null) {
      const children = await listAllFilesFlat(userId, relPath)
      files.push(...children)
    } else {
      files.push(relPath)
    }
  }
  return files
}

// Copy a file in storage then remove the source
async function moveFileInStorage(srcKey: string, dstKey: string): Promise<void> {
  // Try native copy first (single API call, no content transfer)
  const { error: copyErr } = await supabase.storage.from(BUCKET).copy(srcKey, dstKey)
  if (copyErr) {
    // Fallback: download as text and re-upload
    console.warn(`[copy failed, falling back to download+upload] ${copyErr.message}`)
    const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(srcKey)
    if (dlErr || !data) throw new Error(`Cannot download ${srcKey}: ${dlErr?.message}`)
    const text = await data.text()
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(dstKey, text, {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })
    if (upErr) throw new Error(`Cannot upload to ${dstKey}: ${upErr.message}`)
  }
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([srcKey])
  if (rmErr) console.warn(`[remove after move failed] ${srcKey}: ${rmErr.message}`)
}

async function readTrashIndex(userId: string): Promise<TrashIndex> {
  const key = storageKey(userId, '_trash/_index.json')
  const { data, error } = await supabase.storage.from(BUCKET).download(key)
  if (error || !data) return {}
  try {
    return JSON.parse(await data.text())
  } catch {
    return {}
  }
}

async function writeTrashIndex(userId: string, index: TrashIndex): Promise<void> {
  const key = storageKey(userId, '_trash/_index.json')
  await supabase.storage.from(BUCKET).upload(key, JSON.stringify(index), {
    contentType: 'application/json',
    upsert: true,
  })
}

// Recursive listing: each folder requires a separate list() call (S3 limitation)
async function listRecursive(userId: string, prefix: string = ''): Promise<FileNode[]> {
  const listPath = prefix ? `${userId}/${prefix}` : userId

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(listPath, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (error) { console.error('[list]', listPath, error); return [] }
  if (!data) return []
  console.log('[list]', listPath, data.map(i => `${i.name}(id=${i.id})`).join(', '))

  const nodes: FileNode[] = []

  for (const item of data) {
    if (item.name === '.keep') continue
    if (item.name === '_trash') continue  // skip trash folder

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
    .upload(storageKey(userId, `${rel}/.keep`), '', {
      contentType: 'text/plain',
      upsert: true,
    })

  if (error) {
    console.error('[folder/create] Supabase error:', error)
    return res.status(500).json({ error: error.message ?? 'Failed to create folder' })
  }
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

// POST /api/files/upload — upload one or more .md files into a folder (or root)
app.post('/api/files/upload', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { files, folder } = req.body as {
    files: { name: string; content: string }[]
    folder?: string
  }

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' })
  }

  const results: { name: string; ok: boolean; error?: string }[] = []

  for (const file of files) {
    if (!file.name || typeof file.content !== 'string') {
      results.push({ name: file.name ?? '?', ok: false, error: 'Invalid file data' })
      continue
    }

    const safeName = file.name.endsWith('.md') ? file.name : `${file.name}.md`
    const rel = folder ? `${folder}/${safeName}` : safeName
    const key = storageKey(userId, rel)

    const { error } = await supabase.storage.from(BUCKET).upload(key, file.content, {
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

    results.push({ name: safeName, ok: !error, error: error?.message })
  }

  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    console.error('[upload] some files failed:', failed)
  }

  res.json({ ok: true, results })
})

// ─── Trash API ────────────────────────────────────────────────────────────────

// GET /api/trash — list trash items
app.get('/api/trash', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const index = await readTrashIndex(userId)
  const items: TrashEntry[] = Object.entries(index).map(([id, entry]) => ({ id, ...entry }))
  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  res.json(items)
})

// POST /api/trash — move file or folder to trash
app.post('/api/trash', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { path: rel, type } = req.body as { path: string; type: 'file' | 'folder' }
  if (!rel || !type) return res.status(400).json({ error: 'Missing path or type' })

  const trashId = randomUUID()
  const name = rel.split('/').pop()!

  try {
    if (type === 'file') {
      const srcKey = storageKey(userId, rel)
      const dstKey = storageKey(userId, `_trash/${trashId}/${name}`)
      console.log('[trash/move] file', srcKey, '->', dstKey)
      await moveFileInStorage(srcKey, dstKey)
    } else {
      // Folder: move all files including .keep
      const allFiles = await listAllFilesFlat(userId, rel)
      console.log('[trash/move] folder', rel, 'files:', allFiles)
      for (const filePath of allFiles) {
        const relToFolder = filePath.slice(rel.length + 1) // strip "folderPath/"
        const srcKey = storageKey(userId, filePath)
        const dstKey = storageKey(userId, `_trash/${trashId}/${relToFolder}`)
        console.log('[trash/move]   ->', dstKey)
        await moveFileInStorage(srcKey, dstKey)
      }
      // If folder was empty, create a placeholder so the trash entry is non-empty
      if (allFiles.length === 0) {
        console.log('[trash/move] empty folder, creating .keep placeholder')
        await supabase.storage.from(BUCKET).upload(
          storageKey(userId, `_trash/${trashId}/.keep`), '', { contentType: 'text/plain', upsert: true }
        )
      }
    }

    const index = await readTrashIndex(userId)
    index[trashId] = { originalPath: rel, name, type, deletedAt: new Date().toISOString() }
    await writeTrashIndex(userId, index)

    console.log('[trash/move] done, trashId:', trashId)
    res.json({ ok: true, trashId })
  } catch (e) {
    console.error('[trash/move] ERROR:', e)
    res.status(500).json({ error: (e as Error).message ?? 'Failed to move to trash' })
  }
})

// POST /api/trash/restore — restore item from trash
app.post('/api/trash/restore', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const { trashId } = req.body as { trashId: string }
  if (!trashId) return res.status(400).json({ error: 'Missing trashId' })

  const index = await readTrashIndex(userId)
  const entry = index[trashId]
  if (!entry) return res.status(404).json({ error: 'Trash item not found' })

  try {
    const trashFiles = await listAllFilesFlat(userId, `_trash/${trashId}`)

    for (const trashFilePath of trashFiles) {
      // trashFilePath = "_trash/<trashId>/<relative>"
      const relative = trashFilePath.slice(`_trash/${trashId}/`.length)
      const srcKey = storageKey(userId, trashFilePath)
      const dstRel = entry.type === 'file'
        ? entry.originalPath
        : `${entry.originalPath}/${relative}`
      const dstKey = storageKey(userId, dstRel)
      await moveFileInStorage(srcKey, dstKey)
    }

    delete index[trashId]
    await writeTrashIndex(userId, index)

    res.json({ ok: true })
  } catch (e) {
    console.error('[trash/restore]', e)
    res.status(500).json({ error: (e as Error).message ?? 'Failed to restore' })
  }
})

// DELETE /api/trash?id=<trashId> — permanently delete one item
// DELETE /api/trash/all — empty entire trash
app.delete('/api/trash', requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest
  const trashId = req.query.id as string | undefined

  const index = await readTrashIndex(userId)

  try {
    if (trashId) {
      // Permanently delete one item
      const allFiles = await listAllFilesFlat(userId, `_trash/${trashId}`)
      if (allFiles.length > 0) {
        await supabase.storage.from(BUCKET).remove(allFiles.map(f => storageKey(userId, f)))
      }
      delete index[trashId]
    } else {
      // Empty entire trash
      const allTrashFiles = await listAllFilesFlat(userId, '_trash')
      // Include the index file itself
      const allKeys = [
        ...allTrashFiles.map(f => storageKey(userId, f)),
        storageKey(userId, '_trash/_index.json'),
      ]
      if (allKeys.length > 0) {
        await supabase.storage.from(BUCKET).remove(allKeys)
      }
      Object.keys(index).forEach(k => delete index[k])
    }

    if (Object.keys(index).length > 0) {
      await writeTrashIndex(userId, index)
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[trash/delete]', e)
    res.status(500).json({ error: (e as Error).message ?? 'Failed to delete from trash' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
