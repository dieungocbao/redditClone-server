import session from 'express-session'

declare module 'express-session' {
  interface Session {
    userId: string | number
  }
}
