import type { PinoLogger } from 'hono-pino'

declare module 'hono' {
  interface ContextVariableMap {
    logger: PinoLogger
  }
}