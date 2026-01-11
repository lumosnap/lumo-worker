import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Response schemas
const statsResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
        totalUsers: z.number(),
        totalAlbums: z.number(),
        totalImages: z.number(),
        activeUsers: z.number(), // Users who have logged in within last 30 days
    }).optional(),
});

const userSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.string().nullable(),
    banned: z.boolean().nullable(),
    createdAt: z.string().datetime(),
});

const usersListResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
        users: z.array(userSchema),
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
    }).optional(),
});

const setRoleResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: userSchema.optional(),
});

const errorResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

// GET /admin/stats - Platform statistics (any admin)
export const getStatsRoute = createRoute({
    tags: ["Admin"],
    method: "get",
    summary: "Get platform statistics",
    description: "Retrieve platform statistics including user, album, and image counts. Requires admin role.",
    path: "/admin/stats",
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            statsResponseSchema,
            "Platform statistics",
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            errorResponseSchema,
            "User not authenticated",
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            errorResponseSchema,
            "Admin access required",
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            errorResponseSchema,
            "Internal server error",
        ),
    },
});

// GET /admin/users - List all users (any admin)
export const listUsersRoute = createRoute({
    tags: ["Admin"],
    method: "get",
    summary: "List all users",
    description: "Retrieve a paginated list of all users. Requires admin role.",
    path: "/admin/users",
    request: {
        query: z.object({
            limit: z.string().optional().default("20").describe("Number of users to return"),
            offset: z.string().optional().default("0").describe("Offset for pagination"),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            usersListResponseSchema,
            "List of users",
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            errorResponseSchema,
            "User not authenticated",
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            errorResponseSchema,
            "Admin access required",
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            errorResponseSchema,
            "Internal server error",
        ),
    },
});

// POST /admin/users/:userId/role - Set user role (super admin only)
export const setUserRoleRoute = createRoute({
    tags: ["Admin"],
    method: "post",
    summary: "Set user role",
    description: "Set or update a user's role. Only super admin can perform this action.",
    path: "/admin/users/:userId/role",
    request: {
        params: z.object({
            userId: z.string().describe("The ID of the user to update"),
        }),
        body: jsonContent(
            z.object({
                role: z.enum(["user", "admin", "staff"]).describe("The role to assign to the user"),
            }),
            "Role to assign",
        ),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            setRoleResponseSchema,
            "User role updated successfully",
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            errorResponseSchema,
            "Invalid role or user ID",
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            errorResponseSchema,
            "User not authenticated",
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            errorResponseSchema,
            "Super admin access required",
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            errorResponseSchema,
            "User not found",
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            errorResponseSchema,
            "Internal server error",
        ),
    },
});
