import { createMiddleware } from 'hono/factory'

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxRequests = 10 // 10 requests per minute
  
  const key = clientIP
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    // New window, reset count
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
  } else if (record.count >= maxRequests) {
    // Rate limit exceeded
    return c.text('Too Many Requests: Rate limit exceeded', 429)
  } else {
    // Increment count
    record.count++
  }
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k)
      }
    }
  }
  
  await next()
})