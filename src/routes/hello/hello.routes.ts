import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

// Schema for test response
const testResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().nullable(),
    message: z.string().nullable(),
    createdAt: z.string(),
  }).optional(),
});

// GET all tests
export const listTestsRoute = createRoute({
  tags: ["Hello"],
  method: "get",
  summary: "Get all test entries",
  description: "Retrieve all entries from test table",
  path: "/hello",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      testResponseSchema,
      "Test entries retrieved successfully",
    ),
  },
});

// GET single test by ID
export const getTestRoute = createRoute({
  tags: ["Hello"],
  method: "get",
  summary: "Get test entry by ID",
  description: "Retrieve a single test entry",
  path: "/hello/:id",
  request: {
    params: z.object({
      id: z.string().transform(Number),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      testResponseSchema,
      "Test entry retrieved successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Test entry not found",
    ),
  },
});

// POST create test
export const createTestRoute = createRoute({
  tags: ["Hello"],
  method: "post",
  summary: "Create test entry",
  description: "Create a new test entry",
  path: "/hello",
  request: {
    body: jsonContent(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email().optional(),
        message: z.string().max(500).optional(),
      }),
      "Test entry data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      testResponseSchema,
      "Test entry created successfully",
    ),
  },
});

export type ListTestsRoute = typeof listTestsRoute;
export type GetTestRoute = typeof getTestRoute;
export type CreateTestRoute = typeof createTestRoute;
