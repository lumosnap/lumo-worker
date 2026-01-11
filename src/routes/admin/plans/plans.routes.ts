import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

const tags = ["Admin Plans"];

// Schema for Plan
const PlanSchema = z.object({
    id: z.number(),
    name: z.string(),
    displayName: z.string(),
    imageLimit: z.number(),
    priceMonthly: z.union([z.string(), z.number()]).transform((val) => String(val)),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
});

const CreatePlanSchema = z.object({
    name: z.string(), // e.g., "Trial", "Base"
    displayName: z.string(),
    imageLimit: z.number(),
    priceMonthly: z.number().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Schema for Upgrade Request
const UpgradeRequestSchema = z.object({
    id: z.number(),
    userId: z.string(),
    planId: z.number(),
    status: z.enum(['pending', 'approved', 'rejected']),
    durationMonths: z.number().nullable().optional(),
    createdAt: z.string().or(z.date()),
    user: z.object({
        name: z.string().nullable(),
        email: z.string(),
    }).optional(),
    plan: z.object({
        name: z.string(),
        displayName: z.string(),
    }).optional(),
});

const ApproveRequestSchema = z.object({
    durationMonths: z.number().default(12),
    adminNotes: z.string().optional(),
});

const RejectRequestSchema = z.object({
    adminNotes: z.string().optional(),
});

export const listPlans = createRoute({
    path: "/admin/plans",
    method: "get",
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                data: z.array(PlanSchema),
            }),
            "List of plans"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Unauthorized"
        ),
        [HttpStatusCodes.FORBIDDEN]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Forbidden"
        ),
    },
});

export const createPlan = createRoute({
    path: "/admin/plans",
    method: "post",
    tags,
    request: {
        body: jsonContentRequired(CreatePlanSchema, "Plan details"),
    },
    responses: {
        [HttpStatusCodes.CREATED]: jsonContent(
            z.object({
                success: z.boolean(),
                data: PlanSchema,
            }),
            "Plan created"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Unauthorized"
        ),
        [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Internal server error"
        ),
    },
});

const UpdatePlanSchema = z.object({
    displayName: z.string().optional(),
    imageLimit: z.number().optional(),
    priceMonthly: z.number().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
});

export const updatePlan = createRoute({
    path: "/admin/plans/:id",
    method: "patch",
    tags,
    request: {
        params: z.object({
            id: z.string().transform((val) => parseInt(val, 10)),
        }),
        body: jsonContentRequired(UpdatePlanSchema, "Fields to update"),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                data: PlanSchema,
            }),
            "Plan updated"
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Plan not found"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Unauthorized"
        ),
    },
});

export const listUpgradeRequests = createRoute({
    path: "/admin/upgrade-requests",
    method: "get",
    tags,
    request: {
        query: z.object({
            status: z.enum(['pending', 'approved', 'rejected']).optional(),
        }),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                data: z.array(UpgradeRequestSchema),
            }),
            "List of upgrade requests"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Unauthorized"
        ),
    },
});

export const approveUpgradeRequest = createRoute({
    path: "/admin/upgrade-requests/:id/approve",
    method: "post",
    tags,
    request: {
        params: z.object({
            id: z.string().transform((val) => parseInt(val, 10)),
        }),
        body: jsonContentRequired(ApproveRequestSchema, "Approval details"),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                message: z.string(),
            }),
            "Request approved"
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Request not found"
        ),
    },
});

export const rejectUpgradeRequest = createRoute({
    path: "/admin/upgrade-requests/:id/reject",
    method: "post",
    tags,
    request: {
        params: z.object({
            id: z.string().transform((val) => parseInt(val, 10)),
        }),
        body: jsonContentRequired(RejectRequestSchema, "Rejection details"),
    },
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                message: z.string(),
            }),
            "Request rejected"
        ),
        [HttpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Request not found"
        ),
    },
});

export type ListPlansRoute = typeof listPlans;
export type CreatePlanRoute = typeof createPlan;
export type UpdatePlanRoute = typeof updatePlan;
export type ListUpgradeRequestsRoute = typeof listUpgradeRequests;
export type ApproveUpgradeRequestRoute = typeof approveUpgradeRequest;
export type RejectUpgradeRequestRoute = typeof rejectUpgradeRequest;
