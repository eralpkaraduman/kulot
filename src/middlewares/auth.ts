import { createMiddleware } from 'hono/factory'

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.text('Unauthorized: Missing or invalid Authorization header', 401)
  }
  
  const base64Credentials = authHeader.slice('Basic '.length)
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
  const [, password] = credentials.split(':')
  
  const expectedApiKey = process.env.API_KEY
  if (!expectedApiKey) {
    return c.text('Server Error: API key not configured', 500)
  }
  
  if (password !== expectedApiKey) {
    return c.text('Unauthorized: Invalid API key', 401)
  }
  
  await next()
})