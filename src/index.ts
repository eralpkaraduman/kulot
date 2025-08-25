import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { urlSummaryRoute } from './routes/url-summary.js'
import { rateLimitMiddleware } from './middlewares/rate-limit.js'
import { pinoLogger } from 'hono-pino'
import type { PinoLogger } from 'hono-pino'
import pino from 'pino'

type Variables = {
  logger: PinoLogger
}

const app = new Hono<{ Variables: Variables }>()

// Add middlewares
app.use('*', rateLimitMiddleware)
app.use('*', pinoLogger({
  pino: pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard'
      }
    }
  })
}))



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
