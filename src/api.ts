export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

export interface TrashItem {
  id: string
  originalPath: string
  name: string
  type: 'file' | 'folder'
  deletedAt: string
}

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

async function request(url: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    if (authToken) window.location.reload()
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(`${options?.method ?? 'GET'} ${url} → ${res.status}`)
  return res
}

export async function fetchFiles(): Promise<FileNode[]> {
  const res = await request('/api/files')
  return res.json()
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await request(`/api/file?path=${encodeURIComponent(path)}`)
  return res.text()
}

export async function saveFile(path: string, content: string): Promise<void> {
  await request(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export async function createFile(path: string): Promise<void> {
  await request('/api/file/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

export async function deleteFile(path: string): Promise<void> {
  await request(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await request('/api/file/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  })
}

export async function createFolder(path: string): Promise<void> {
  await request('/api/folder/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

export async function uploadFiles(
  files: { name: string; content: string }[],
  folder: string = ''
): Promise<{ name: string; ok: boolean; error?: string }[]> {
  const res = await request('/api/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, folder }),
  })
  const data = await res.json()
  return data.results
}

// ─── Trash ────────────────────────────────────────────────────────────────────

export async function fetchTrash(): Promise<TrashItem[]> {
  const res = await request('/api/trash')
  return res.json()
}

export async function moveToTrash(path: string, type: 'file' | 'folder'): Promise<void> {
  await request('/api/trash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, type }),
  })
}

export async function restoreFromTrash(trashId: string): Promise<void> {
  await request('/api/trash/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashId }),
  })
}

export async function deleteFromTrash(trashId: string): Promise<void> {
  await request(`/api/trash?id=${encodeURIComponent(trashId)}`, { method: 'DELETE' })
}

export async function emptyTrash(): Promise<void> {
  await request('/api/trash', { method: 'DELETE' })
}
