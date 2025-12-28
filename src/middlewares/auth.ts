import { createMiddleware } from 'hono/factory'
import type { AppBindings, User, Session } from '@/lib/types'
import { createAuth } from '@/lib/auth'

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  try {
    const db = c.get('db')
    const auth = createAuth(db, c.env)

    // Get session using Better Auth's native method
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })

    // Set user and session in context (cast to AppBindings types)
    if (session?.user) {
      c.set('user', session.user as User)
      c.set('session', session.session as Session)
    } else {
      c.set('user', null)
      c.set('session', null)
    }
  } catch (error: unknown) {
    // Session is invalid or expired - use logger if available
    const logger = c.get('logger')
    if (logger) {
      logger.debug({ error }, 'Session validation failed')
    }
    c.set('user', null)
    c.set('session', null)
  }

  await next()
})