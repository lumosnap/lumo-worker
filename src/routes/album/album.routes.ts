import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";


const albumSchema = z.object({
  id: z.string(),
  userId: z.number().int().nullable(),
  title: z.string(),
  eventDate: z.string().nullable(),
  totalImages: z.number().int(),
  totalSize: z.number().nullable(),
  shareLinkToken: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const createAlbumSchema = z.object({
  title: z.string().min(1).max(255).describe("The title of the album."),
  userId: z.number().int().optional().describe("The ID of the user associated with the album."),
  eventDate: z.string().optional().describe("The date of the event (e.g., '2025-12-31')."),
  expiresAt: z.string().datetime().optional().describe("The expiration date for a share link."),
  isPublic: z.boolean().optional().describe("Whether the album is publicly visible."),
});

const singleAlbumResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: albumSchema.optional(),
});

const albumListResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.array(albumSchema).optional(),
});

const generateUploadUrlResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.array(z.object({
        filename: z.string(),
        uploadUrl: z.string().url(),
        key: z.string(),
    })).optional()
})


// ==================================================
// Routes
// ==================================================


// GET all albums
export const listAlbumsRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get all album entries",
  description: "Retrieve all entries from albums table",
  path: "/albums",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      albumListResponseSchema,
      "Album entries retrieved successfully",
    ),
  },
});

// POST create album
export const createAlbumRoute = createRoute({
  tags: ["Albums"],
  method: "post",
  summary: "Create album entry",
  description: "Create a new album entry",
  path: "/albums",
  request: {
    body: jsonContent(
      createAlbumSchema,
      "Album entry data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      singleAlbumResponseSchema,
      "Album entry created successfully",
    ),
  },
});

export const generateUploadUrlRoute = createRoute({
  tags: ["Albums"],
  method: "post",
  summary: "Generate upload urls",
  description: "Generate presigned URLs for uploading files to an album.",
  path: "/albums/:albumId/upload",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      z.object({
        files: z.array(z.object({
          filename: z.string()
        })).min(1)
      }),
      "A list of filenames to generate upload URLs for.",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      generateUploadUrlResponseSchema,
      "Upload URLs created successfully",
    ),
  },
})

export type ListAlbumsRoute = typeof listAlbumsRoute;
export type CreateAlbumRoute = typeof createAlbumRoute;
export type GenerateUploadUrlRoute = typeof generateUploadUrlRoute;
