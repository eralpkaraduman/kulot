import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { urlSummaryRoute } from './routes/url-summary.js'
import { rateLimitMiddleware } from './middlewares/rate-limit.js'

type Variables = {
  requestId: string
}

const app = new Hono<{ Variables: Variables }>()


// Request ID middleware
const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  c.set('requestId', requestId)
  await next()
})

// Add middlewares
app.use('*', requestIdMiddleware)
app.use('*', rateLimitMiddleware)
app.use('*', logger())



app.get('/', (c) => {
  return c.text('Külot! 🩲')
})

// Mount the URL summary routes
app.route('/', urlSummaryRoute)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
