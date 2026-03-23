import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getFolderById, selectPublicFolders } from '~/model/folder'
import { getPageById, queryPage, selectPageTotalCount } from '~/model/page'
import result from '~/utils/result'

const app = new Hono<HonoTypeUserInformation>()

// GET /api/public/folders — list all public folders
app.get('/folders', async (c) => {
  const folders = await selectPublicFolders(c.env.DB)
  return c.json(result.success(folders))
})

// POST /api/public/pages/query — paginate pages from a public folder
app.post(
  '/pages/query',
  validator('json', (value, c) => {
    if (!value.folderId || typeof value.folderId !== 'number') {
      return c.json(result.error(400, 'folderId is required'))
    }
    if (!value.pageNumber || typeof value.pageNumber !== 'number') {
      return c.json(result.error(400, 'pageNumber is required'))
    }
    if (!value.pageSize || typeof value.pageSize !== 'number') {
      return c.json(result.error(400, 'pageSize is required'))
    }
    return {
      folderId: value.folderId as number,
      pageNumber: value.pageNumber as number,
      pageSize: value.pageSize as number,
      keyword: typeof value.keyword === 'string' ? value.keyword : '',
    }
  }),
  async (c) => {
    const { folderId, pageNumber, pageSize, keyword } = c.req.valid('json')

    const folder = await getFolderById(c.env.DB, { id: folderId })
    if (!folder || !folder.isPublic || folder.isDeleted) {
      return c.json(result.error(403, 'Folder is not public'))
    }

    const [pages, total] = await Promise.all([
      queryPage(c.env.DB, { folderId, pageNumber, pageSize, keyword }),
      selectPageTotalCount(c.env.DB, { folderId, keyword }),
    ])

    return c.json(result.success({ list: pages, total }))
  },
)

// GET /api/public/pages/detail?id=X — get page metadata (must be in a public folder)
app.get(
  '/pages/detail',
  validator('query', (value, c) => {
    if (!value.id || Number.isNaN(Number(value.id))) {
      return c.json(result.error(400, 'ID is required'))
    }
    return { id: Number(value.id) }
  }),
  async (c) => {
    const { id } = c.req.valid('query')
    const page = await getPageById(c.env.DB, { id, isDeleted: false })
    if (!page) {
      return c.json(result.error(404, 'Page not found'))
    }

    const folder = await getFolderById(c.env.DB, { id: page.folderId })
    if (!folder || !folder.isPublic || folder.isDeleted) {
      return c.json(result.error(403, 'Page is not publicly accessible'))
    }

    return c.json(result.success(page))
  },
)

// GET /api/public/pages/content?pageId=X — serve archived HTML (must be in a public folder)
app.get('/pages/content', async (c) => {
  const pageId = c.req.query('pageId')
  if (!pageId || Number.isNaN(Number(pageId))) {
    return c.redirect('/error')
  }

  const page = await getPageById(c.env.DB, { id: Number(pageId), isDeleted: false })
  if (!page) {
    return c.redirect('/error')
  }

  const folder = await getFolderById(c.env.DB, { id: page.folderId })
  if (!folder || !folder.isPublic || folder.isDeleted) {
    return c.redirect('/error')
  }

  const content = await c.env.BUCKET.get(page.contentUrl)
  if (!content) {
    return c.redirect('/error')
  }

  return c.html(await content.text())
})

const BOT_UA_RE = /TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|Googlebot/i

// GET /api/public/iv/:pageId — Telegram Instant View compatible endpoint
app.get('/iv/:pageId', async (c) => {
  const pageId = c.req.param('pageId')
  if (!pageId || Number.isNaN(Number(pageId)))
    return c.redirect('/error')

  const ua = c.req.header('user-agent') ?? ''
  if (!BOT_UA_RE.test(ua))
    return c.redirect(`/showcase/page/${pageId}`)

  const page = await getPageById(c.env.DB, { id: Number(pageId), isDeleted: false })
  if (!page)
    return c.redirect('/error')

  const folder = await getFolderById(c.env.DB, { id: page.folderId })
  const accessible = page.isShowcased === 1 || (folder?.isPublic === 1 && !folder.isDeleted)
  if (!accessible)
    return c.redirect('/error')

  const raw = await c.env.BUCKET.get(page.contentUrl)
  if (!raw)
    return c.redirect('/error')

  const baseUrl = new URL(c.req.url).origin
  const canonicalUrl = `${baseUrl}/api/public/iv/${pageId}`
  const title = page.title.replace(/"/g, '&quot;')
  const desc = (page.pageDesc ?? '').replace(/"/g, '&quot;')
  const screenshotUrl = page.screenshotId
    ? `${baseUrl}/api/pages/screenshot?id=${page.screenshotId}`
    : ''

  const ivMeta = [
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    screenshotUrl ? `<meta property="og:image" content="${screenshotUrl}" />` : '',
    `<link rel="canonical" href="${canonicalUrl}" />`,
  ].filter(Boolean).join('\n')

  const html = (await raw.text()).replace(/<head([^>]*)>/i, `<head$1>\n${ivMeta}`)
  return c.html(html)
})

export default app
