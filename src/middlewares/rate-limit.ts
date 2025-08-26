import { rateLimiter } from 'hono-rate-limiter'

export const rateLimitMiddleware = rateLimiter({
  windowMs: 60 * 1000, 
  limit: 10,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
  message: 'Too Many Requests: Rate limit exceeded'
})