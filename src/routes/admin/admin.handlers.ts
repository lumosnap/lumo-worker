import { eq, count, sql, gte } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import type * as routes from "./admin.routes";
import { user, session } from "@/db/d1-schema/auth";
import { albums, images } from "@/db/d1-schema/albums";

type GetStatsRoute = typeof routes.getStatsRoute;
type ListUsersRoute = typeof routes.listUsersRoute;
type SetUserRoleRoute = typeof routes.setUserRoleRoute;

/**
 * Get platform statistics
 * Returns counts of users, albums, and images
 */
export const getStats: AppRouteHandler<GetStatsRoute> = async (c) => {
    const db = c.get("db");

    try {
        // Get total users count
        const [usersResult] = await db.select({ count: count() }).from(user);

        // Get total albums count
        const [albumsResult] = await db.select({ count: count() }).from(albums);

        // Get total images count
        const [imagesResult] = await db.select({ count: count() }).from(images);

        // Get active users (users with sessions updated in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [activeUsersResult] = await db
            .select({ count: sql<number>`count(distinct ${session.userId})` })
            .from(session)
            .where(gte(session.updatedAt, thirtyDaysAgo));

        return c.json(
            {
                success: true,
                message: "Statistics retrieved successfully",
                data: {
                    totalUsers: usersResult?.count || 0,
                    totalAlbums: albumsResult?.count || 0,
                    totalImages: imagesResult?.count || 0,
                    activeUsers: Number(activeUsersResult?.count) || 0,
                },
            },
            HttpStatusCodes.OK
        );
    } catch (error) {
        const logger = c.get("logger");
        logger.error({ error }, "Failed to get platform statistics");

        return c.json(
            {
                success: false,
                message: "Failed to retrieve statistics",
            },
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * List all users with pagination
 */
export const listUsers: AppRouteHandler<ListUsersRoute> = async (c) => {
    const db = c.get("db");
    const { limit: limitStr, offset: offsetStr } = c.req.valid("query");

    const limit = parseInt(limitStr, 10);
    const offset = parseInt(offsetStr, 10);

    try {
        // Get users with pagination
        const usersData = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                banned: user.banned,
                createdAt: user.createdAt,
            })
            .from(user)
            .limit(limit)
            .offset(offset)
            .orderBy(user.createdAt);

        // Get total count
        const [totalResult] = await db.select({ count: count() }).from(user);

        return c.json(
            {
                success: true,
                message: "Users retrieved successfully",
                data: {
                    users: usersData.map((u) => ({
                        ...u,
                        createdAt: u.createdAt.toISOString(),
                    })),
                    total: totalResult?.count || 0,
                    limit,
                    offset,
                },
            },
            HttpStatusCodes.OK
        );
    } catch (error) {
        const logger = c.get("logger");
        logger.error({ error }, "Failed to list users");

        return c.json(
            {
                success: false,
                message: "Failed to retrieve users",
            },
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

/**
 * Set a user's role (super admin only)
 */
export const setUserRole: AppRouteHandler<SetUserRoleRoute> = async (c) => {
    const db = c.get("db");
    const { userId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const currentUser = c.get("user");

    try {
        // Prevent super admin from changing their own role
        if (currentUser?.id === userId) {
            return c.json(
                {
                    success: false,
                    message: "Cannot change your own role",
                },
                HttpStatusCodes.BAD_REQUEST
            );
        }

        // Check if user exists
        const [existingUser] = await db
            .select()
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

        if (!existingUser) {
            return c.json(
                {
                    success: false,
                    message: "User not found",
                },
                HttpStatusCodes.NOT_FOUND
            );
        }

        // Prevent changing super admin's role
        if (existingUser.email === c.env.SUPER_ADMIN_EMAIL) {
            return c.json(
                {
                    success: false,
                    message: "Cannot change super admin's role",
                },
                HttpStatusCodes.FORBIDDEN
            );
        }

        // Update user role
        const [updatedUser] = await db
            .update(user)
            .set({ role, updatedAt: new Date() })
            .where(eq(user.id, userId))
            .returning();

        const logger = c.get("logger");
        logger.info(
            { userId, newRole: role, changedBy: currentUser?.id },
            "User role updated"
        );

        return c.json(
            {
                success: true,
                message: `User role updated to ${role}`,
                data: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    banned: updatedUser.banned,
                    createdAt: updatedUser.createdAt.toISOString(),
                },
            },
            HttpStatusCodes.OK
        );
    } catch (error) {
        const logger = c.get("logger");
        logger.error({ error, userId, role }, "Failed to set user role");

        return c.json(
            {
                success: false,
                message: "Failed to update user role",
            },
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};
