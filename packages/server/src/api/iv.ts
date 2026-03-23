import { Hono } from 'hono'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getFolderById } from '~/model/folder'
import { getPageById } from '~/model/page'

const app = new Hono<HonoTypeUserInformation>()

const BOT_UA_RE = /TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|Googlebot/i

// Flatten nested blockquotes: IV doesn't support <blockquote> inside <blockquote>
function flattenBlockquotes(html: string): string {
  let prev = ''
  let out = html
  while (out !== prev) {
    prev = out
    out = out
      .replace(/<blockquote([^>]*)>(\s*)<blockquote/gi, '<div$1>$2<blockquote')
      .replace(/<\/blockquote>(\s*)<\/blockquote>/g, '</blockquote>$1</div>')
  }
  return out
}

// GET /iv/:pageId — clean public URL for Telegram Instant View and link previews
// Bots receive annotated HTML; real browsers are redirected to the appropriate SPA route
app.get('/:pageId', async (c) => {
  const pageId = c.req.param('pageId')
  if (!pageId || Number.isNaN(Number(pageId)))
    return c.redirect('/error')

  const page = await getPageById(c.env.DB, { id: Number(pageId), isDeleted: false })
  if (!page)
    return c.redirect('/error')

  const folder = await getFolderById(c.env.DB, { id: page.folderId })
  const isShowcased = page.isShowcased === 1
  const isPublicFolder = folder?.isPublic === 1 && !folder.isDeleted
  if (!isShowcased && !isPublicFolder)
    return c.redirect('/error')

  const ua = c.req.header('user-agent') ?? ''
  if (!BOT_UA_RE.test(ua)) {
    return isShowcased
      ? c.redirect(`/#/showcase/page/${pageId}`)
      : c.redirect(`/#/page/${pageId}`)
  }

  const raw = await c.env.BUCKET.get(page.contentUrl)
  if (!raw)
    return c.redirect('/error')

  const baseUrl = new URL(c.req.url).origin
  const canonicalUrl = `${baseUrl}/iv/${pageId}`
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

  const rawHtml = await raw.text()
  const html = flattenBlockquotes(rawHtml).replace(/<head([^>]*)>/i, `<head$1>\n${ivMeta}`)
  return c.html(html)
})

export default app
