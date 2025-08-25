import { rateLimiter } from 'hono-rate-limiter'

export const rateLimitMiddleware = rateLimiter({
  windowMs: 60 * 1000, // 1 minute window
  limit: 10, // 10 requests per minute per IP
  standardHeaders: 'draft-6', // Add RateLimit-* headers
  keyGenerator: (c) => {
    // Use same IP detection logic as original implementation
    return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  },
  message: 'Too Many Requests: Rate limit exceeded'
})