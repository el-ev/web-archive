import { Hono } from 'hono'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getFolderById } from '~/model/folder'
import { getPageById } from '~/model/page'

const app = new Hono<HonoTypeUserInformation>()

const BOT_UA_RE = /TelegramBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|Googlebot/i

// GET /iv/:pageId — clean public URL for Telegram Instant View and link previews
// Real browsers are redirected to the SPA; bots receive annotated HTML
app.get('/:pageId', async (c) => {
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

  const html = (await raw.text()).replace(/<head([^>]*)>/i, `<head$1>\n${ivMeta}`)
  return c.html(html)
})

export default app
