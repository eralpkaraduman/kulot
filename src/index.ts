import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { urlSummaryRoute } from './routes/url-summary.js'
import { rateLimitMiddleware } from './middlewares/rate-limit.js'
import { authMiddleware } from './middlewares/auth.js'
import { pinoLogger } from 'hono-pino'
import pino from 'pino'

const app = new Hono()

app.use('*', pinoLogger({
  pino: pino(process.env.NODE_ENV !== 'production' ? {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  } : {
    level: 'info'
  })
}))

app.use('*', rateLimitMiddleware)

app.get('/', (c) => {
  return c.text('Külot! 🩲')
})

const apiRouter = new Hono()
apiRouter.use('*', authMiddleware)
apiRouter.route('/', urlSummaryRoute)
app.route('/api', apiRouter)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
