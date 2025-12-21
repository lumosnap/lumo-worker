import { createMiddleware } from 'hono/factory'
import type { AppBindings } from '@/lib/types'

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  try {
    // Import auth configuration
    const { createAuth } = await import('@/lib/auth')
    const { createDb } = await import('@/db')
    
    const { db } = createDb(c.env)
    const auth = createAuth(db, c.env)
    
    // Get session using Better Auth's native method
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    
    // Set user and session in context
    if (session?.user) {
      c.set('user', session.user)
      c.set('session', session.session)
    } else {
      c.set('user', null)
      c.set('session', null)
    }
  } catch (error) {
    // Session is invalid or expired
    console.log('Session validation failed:', error)
    c.set('user', null)
    c.set('session', null)
  }
  
  await next()
})