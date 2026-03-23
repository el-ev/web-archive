import { Hono } from 'hono'
import type { Bindings, HonoTypeUserInformation } from './constants/binding'
import tokenMiddleware from './middleware/token'
import data from './api/data'
import showcase from '~/api/showcase'
import publicRoutes from '~/api/public'
import pages from '~/api/pages'
import auth from '~/api/auth'
import folders from '~/api/folders'
import tags from '~/api/tags'
import config from '~/api/config'
import iv from '~/api/iv'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  return c.html(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="/static/index.js"></script>
  <link rel="stylesheet" href="/static/index.css">
  <link rel="icon" href="/static/favicon.ico" />
  <title>Archive</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
  )
})

const api = new Hono<HonoTypeUserInformation>()
api.route('/showcase', showcase)
api.route('/public', publicRoutes)

api.use(tokenMiddleware)

api.route('/pages', pages)
api.route('/auth', auth)
api.route('/folders', folders)
api.route('/tags', tags)
api.route('/data', data)
api.route('/config', config)
app.route('/api', api)
app.route('/iv', iv)

export default app
