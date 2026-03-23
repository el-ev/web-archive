import type { Folder, Page } from '@web-archive/shared/types'

async function publicFetch<T>(url: string, options: RequestInit): Promise<T | null> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok)
    return null
  const content = await res.json() as { code: number, data: T }
  if (content.code !== 200)
    return null
  return content.data
}

async function getPublicFolders(): Promise<Folder[]> {
  const data = await publicFetch<Folder[]>('/api/public/folders', { method: 'GET' })
  return data ?? []
}

async function queryPublicPages(body: {
  folderId: number
  pageNumber: number
  pageSize: number
  keyword: string
}): Promise<{ list: Page[], total: number }> {
  const data = await publicFetch<{ list: Page[], total: number }>('/api/public/pages/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data ?? { list: [], total: 0 }
}

async function getPublicPageDetail(id: string): Promise<Page | null> {
  return publicFetch<Page>(`/api/public/pages/detail?id=${id}`, { method: 'GET' })
}

async function getPublicPageContent(pageId: string): Promise<string> {
  const res = await fetch(`/api/public/pages/content?pageId=${pageId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'text/html' },
  })
  if (!res.ok)
    return ''
  return res.text()
}

function getPublicPageScreenshot(screenshotId: string | null) {
  return async () => {
    if (!screenshotId)
      return null
    const res = await fetch(`/api/pages/screenshot?id=${screenshotId}`, {
      method: 'GET',
    })
    return res.ok ? res.blob() : null
  }
}

export {
  getPublicFolders,
  queryPublicPages,
  getPublicPageDetail,
  getPublicPageContent,
  getPublicPageScreenshot,
}
