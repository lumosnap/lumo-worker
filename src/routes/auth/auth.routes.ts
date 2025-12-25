import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Shared schemas
const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const googleDesktopAuthRequestSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const googleDesktopAuthSuccessSchema = z.object({
  success: z.literal(true),
  user: authUserSchema,
  token: z.string(),
});

const googleDesktopAuthErrorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  redirectUrl: z.string().nullable().optional(),
});

// ==================================================
// Routes
// ==================================================

// POST Google Desktop Auth
export const googleDesktopAuthRoute = createRoute({
  tags: ["Auth"],
  method: "post",
  summary: "Google Desktop Authentication",
  description: "Authenticate with Google using idToken from desktop app",
  path: "/auth/google/desktop",
  request: {
    body: jsonContent(
      googleDesktopAuthRequestSchema,
      "Google idToken",
    ),
  },
  security: [],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      googleDesktopAuthSuccessSchema,
      "Authentication successful",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      googleDesktopAuthErrorSchema,
      "Missing or invalid idToken",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      googleDesktopAuthErrorSchema,
      "Internal server error",
    ),
  },
});

export type GoogleDesktopAuthRoute = typeof googleDesktopAuthRoute;
