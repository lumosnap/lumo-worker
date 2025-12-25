import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Shared schemas
const errorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const googleAuthRequestSchema = z.object({
  code: z.string().min(1, "Code is required"),
});

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  expiresAt: z.string().datetime().optional(),
  token: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const googleAuthResponseSchema = z.object({
  user: userSchema,
  session: sessionSchema,
});

// ==================================================
// Routes
// ==================================================

// POST Google Desktop Auth
export const googleDesktopAuthRoute = createRoute({
  tags: ["Auth"],
  method: "post",
  summary: "Google Desktop Authentication",
  description: "Authenticate with Google using OAuth code from desktop app",
  path: "/auth/google/desktop",
  request: {
    body: jsonContent(
      googleAuthRequestSchema,
      "Google OAuth code",
    ),
  },
  security: [],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      googleAuthResponseSchema,
      "Authentication successful",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorResponseSchema,
      "Missing or invalid code",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

export type GoogleDesktopAuthRoute = typeof googleDesktopAuthRoute;
