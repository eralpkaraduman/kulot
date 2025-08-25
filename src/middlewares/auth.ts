import { bearerAuth } from 'hono/bearer-auth'

export const authMiddleware = bearerAuth({
  token: process.env.API_KEY || ''
})