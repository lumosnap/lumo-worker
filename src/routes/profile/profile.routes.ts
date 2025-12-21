import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Shared error response schema
const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const profileSchema = z.object({
  id: z.number(),
  userId: z.string().nullable(),
  businessName: z.string().nullable(),
  phone: z.string().nullable(),
  storageUsed: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const updateProfileSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
});

const billingAddressSchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
  isDefault: z.boolean().nullable(),
  createdAt: z.string().datetime(),
});

const createBillingAddressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zip: z.string().min(1).max(20),
  country: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
});

const profileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: profileSchema.optional(),
});

const billingAddressResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: billingAddressSchema.optional(),
});

const billingAddressesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(billingAddressSchema).optional(),
});

// ==================================================
// Routes
// ==================================================

// GET current user's profile
export const getProfileRoute = createRoute({
  tags: ["Profile"],
  method: "get",
  summary: "Get user profile",
  description: "Retrieve the current user's profile information",
  path: "/profile",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      profileResponseSchema,
      "Profile retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Profile not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// PUT update profile
export const updateProfileRoute = createRoute({
  tags: ["Profile"],
  method: "put",
  summary: "Update user profile",
  description: "Update the current user's profile information",
  path: "/profile",
  request: {
    body: jsonContent(
      updateProfileSchema,
      "Profile update data",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      profileResponseSchema,
      "Profile updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Profile not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// GET billing addresses
export const getBillingAddressesRoute = createRoute({
  tags: ["Profile"],
  method: "get",
  summary: "Get billing addresses",
  description: "Retrieve all billing addresses for the current user",
  path: "/profile/billing-addresses",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      billingAddressesResponseSchema,
      "Billing addresses retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Profile not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// POST create billing address
export const createBillingAddressRoute = createRoute({
  tags: ["Profile"],
  method: "post",
  summary: "Create billing address",
  description: "Add a new billing address for the current user",
  path: "/profile/billing-addresses",
  request: {
    body: jsonContent(
      createBillingAddressSchema,
      "Billing address data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      billingAddressResponseSchema,
      "Billing address created successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Profile not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// PUT update billing address
export const updateBillingAddressRoute = createRoute({
  tags: ["Profile"],
  method: "put",
  summary: "Update billing address",
  description: "Update an existing billing address",
  path: "/profile/billing-addresses/:addressId",
  request: {
    params: z.object({
      addressId: z.string(),
    }),
    body: jsonContent(
      createBillingAddressSchema,
      "Billing address update data",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      billingAddressResponseSchema,
      "Billing address updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Billing address not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// DELETE billing address
export const deleteBillingAddressRoute = createRoute({
  tags: ["Profile"],
  method: "delete",
  summary: "Delete billing address",
  description: "Delete a billing address",
  path: "/profile/billing-addresses/:addressId",
  request: {
    params: z.object({
      addressId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      errorResponseSchema,
      "Billing address deleted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Billing address not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

export type GetProfileRoute = typeof getProfileRoute;
export type UpdateProfileRoute = typeof updateProfileRoute;
export type GetBillingAddressesRoute = typeof getBillingAddressesRoute;
export type CreateBillingAddressRoute = typeof createBillingAddressRoute;
export type UpdateBillingAddressRoute = typeof updateBillingAddressRoute;
export type DeleteBillingAddressRoute = typeof deleteBillingAddressRoute;