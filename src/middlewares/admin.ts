import { createMiddleware } from 'hono/factory'
import type { AppBindings } from '@/lib/types'
import * as HttpStatusCodes from 'stoker/http-status-codes'

/**
 * Middleware to require admin, superadmin, or staff role
 * Use this for routes accessible by any admin user
 */
export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
        return c.json(
            { success: false, message: 'Authentication required' },
            HttpStatusCodes.UNAUTHORIZED
        )
    }

    const adminRoles = ['superadmin', 'admin', 'staff']
    const userRoles = user.role?.split(',').map(r => r.trim()) || []

    const hasAdminRole = userRoles.some(role => adminRoles.includes(role))

    if (!hasAdminRole) {
        return c.json(
            { success: false, message: 'Admin access required' },
            HttpStatusCodes.FORBIDDEN
        )
    }

    await next()
})

/**
 * Middleware to require superadmin role only
 * Use this for routes that only the super admin can access (e.g., adding new admins)
 */
export const requireSuperAdmin = createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
        return c.json(
            { success: false, message: 'Authentication required' },
            HttpStatusCodes.UNAUTHORIZED
        )
    }

    // Check if user has superadmin role OR matches the SUPER_ADMIN_EMAIL
    const userRoles = user.role?.split(',').map(r => r.trim()) || []
    const isSuperAdmin = userRoles.includes('superadmin') || user.email === c.env.SUPER_ADMIN_EMAIL

    if (!isSuperAdmin) {
        return c.json(
            { success: false, message: 'Super admin access required' },
            HttpStatusCodes.FORBIDDEN
        )
    }

    await next()
})
