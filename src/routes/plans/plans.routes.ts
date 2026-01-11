import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

const tags = ["Plans"];

const PlanSchema = z.object({
    id: z.number(),
    name: z.string(),
    displayName: z.string(),
    imageLimit: z.number(),
    priceMonthly: z.union([z.string(), z.number()]).transform((val) => String(val)),
    description: z.string().nullable().optional(),
});

const RequestUpgradeSchema = z.object({
    planId: z.number(),
});

export const listPublicPlans = createRoute({
    path: "/plans",
    method: "get",
    tags,
    responses: {
        [HttpStatusCodes.OK]: jsonContent(
            z.object({
                success: z.boolean(),
                data: z.array(PlanSchema),
            }),
            "List of available plans"
        ),
    },
});

export const requestUpgrade = createRoute({
    path: "/plans/request-upgrade",
    method: "post",
    tags,
    request: {
        body: jsonContentRequired(RequestUpgradeSchema, "Upgrade request details"),
    },
    responses: {
        [HttpStatusCodes.CREATED]: jsonContent(
            z.object({
                success: z.boolean(),
                message: z.string(),
            }),
            "Upgrade requested successfully"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Unauthorized"
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            z.object({ success: z.boolean(), message: z.string() }),
            "Bad request (e.g. invalid plan)"
        ),
    },
});

export type ListPublicPlansRoute = typeof listPublicPlans;
export type RequestUpgradeRoute = typeof requestUpgrade;
