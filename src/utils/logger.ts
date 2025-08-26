import pino from 'pino'

export const appLogger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid',
      translateTime: 'SYS:standard'
    }
  }
})