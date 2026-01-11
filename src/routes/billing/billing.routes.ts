import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Shared error response schema
const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const planSchema = z.object({
  id: z.number(),
  name: z.string(), // Changed from enum to string
  displayName: z.string(),
  priceMonthly: z.string().nullable(), // DB stores as decimal string
  storageLimit: z.number().nullable(),
  maxAlbums: z.number().nullable(),
  features: z.any(),
  isActive: z.boolean().nullable(),
  createdAt: z.string().datetime(),
});

const subscriptionSchema = z.object({
  id: z.number(),
  userId: z.string().nullable(),
  planId: z.number().nullable(),
  status: z.string(), // Changed from enum to string
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  stripeSubscriptionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const subscriptionWithPlanSchema = subscriptionSchema.extend({
  plan: planSchema.omit({ createdAt: true, isActive: true }).nullable(),
});

const createSubscriptionSchema = z.object({
  planId: z.number().int(),
  paymentMethodId: z.string().optional(),
});

const updateSubscriptionSchema = z.object({
  planId: z.number().int(),
});

const plansResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(planSchema).optional(),
});

const subscriptionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: subscriptionWithPlanSchema.optional(),
});

// ==================================================
// Routes
// ==================================================

// GET all plans
export const getPlansRoute = createRoute({
  tags: ["Billing"],
  method: "get",
  summary: "Get available plans",
  description: "Retrieve all available subscription plans",
  path: "/billing/plans",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      plansResponseSchema,
      "Plans retrieved successfully",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Internal server error",
    ),
  },
});

// GET current user's subscription
export const getSubscriptionRoute = createRoute({
  tags: ["Billing"],
  method: "get",
  summary: "Get user subscription",
  description: "Retrieve the current user's subscription information",
  path: "/billing/subscription",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      subscriptionResponseSchema,
      "Subscription retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Subscription not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// POST create subscription
export const createSubscriptionRoute = createRoute({
  tags: ["Billing"],
  method: "post",
  summary: "Create subscription",
  description: "Create a new subscription for the current user",
  path: "/billing/subscription",
  request: {
    body: jsonContent(
      createSubscriptionSchema,
      "Subscription creation data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      subscriptionResponseSchema,
      "Subscription created successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorResponseSchema,
      "Bad request",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// PUT update subscription (change plan)
export const updateSubscriptionRoute = createRoute({
  tags: ["Billing"],
  method: "put",
  summary: "Update subscription",
  description: "Update the current user's subscription (change plan)",
  path: "/billing/subscription",
  request: {
    body: jsonContent(
      updateSubscriptionSchema,
      "Subscription update data",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      subscriptionResponseSchema,
      "Subscription updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorResponseSchema,
      "Invalid plan",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Subscription not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// DELETE cancel subscription
export const cancelSubscriptionRoute = createRoute({
  tags: ["Billing"],
  method: "delete",
  summary: "Cancel subscription",
  description: "Cancel the current user's subscription",
  path: "/billing/subscription",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      errorResponseSchema,
      "Subscription cancelled successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Subscription not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

export type GetPlansRoute = typeof getPlansRoute;
export type GetSubscriptionRoute = typeof getSubscriptionRoute;
export type CreateSubscriptionRoute = typeof createSubscriptionRoute;
export type UpdateSubscriptionRoute = typeof updateSubscriptionRoute;
export type CancelSubscriptionRoute = typeof cancelSubscriptionRoute;