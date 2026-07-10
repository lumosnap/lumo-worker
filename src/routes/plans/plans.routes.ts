import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { errorResponseSchema, PlanSchema } from "@/lib/openapi-schemas";

const tags = ["Plans"];

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
            errorResponseSchema,
            "Upgrade requested successfully"
        ),
        [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
            errorResponseSchema,
            "Unauthorized"
        ),
        [HttpStatusCodes.BAD_REQUEST]: jsonContent(
            errorResponseSchema,
            "Bad request (e.g. invalid plan)"
        ),
    },
});

export type ListPublicPlansRoute = typeof listPublicPlans;
export type RequestUpgradeRoute = typeof requestUpgrade;
