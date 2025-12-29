import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const commentSchema = z.object({
  clientName: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const userFavoriteSchema = z.object({
  id: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const imageSchema = z.object({
  id: z.number(),
  originalFilename: z.string(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string().datetime(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  favoriteCount: z.number(),
  comments: z.array(commentSchema),
  userFavorite: userFavoriteSchema.nullable(),
});

const favoriteSchema = z.object({
  id: z.number(),
  albumId: z.string().nullable(),
  imageId: z.number().nullable(),
  clientName: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const createFavoriteSchema = z.object({
  imageId: z.number().int(),
  clientName: z.string().min(1).max(255),
  notes: z.string().optional(),
});

const updateNotesSchema = z.object({
  clientName: z.string().min(1).max(255),
  notes: z.string().optional(),
});

const deleteFavoriteSchema = z.object({
  clientName: z.string().min(1).max(255),
});

const favoriteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: favoriteSchema.optional(),
});

// ==================================================
// Routes
// ==================================================

// GET album by share token
export const getAlbumByTokenRoute = createRoute({
  tags: ["Public"],
  method: "get",
  summary: "Get album by share token",
  description: "Retrieve an album and its images using a share token with pagination",
  path: "/share/:token",
  request: {
    params: z.object({
      token: z.string(),
    }),
    query: z.object({
      clientName: z.string().optional(),
      favorites: z.string().optional(),
      page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
      limit: z.string().optional().transform((val) => val ? parseInt(val) : 20),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.object({
          album: z.object({
            id: z.string(),
            title: z.string(),
            eventDate: z.string().nullable(),
            totalImages: z.number(),
            shareLinkToken: z.string().nullable(),
            favoritedPhotosCount: z.number(),
            ownerName: z.string().nullable(),
          }),
          images: z.array(imageSchema),
          pagination: z.object({
            currentPage: z.number(),
            totalPages: z.number(),
            totalImages: z.number(),
            hasNextPage: z.boolean(),
            hasPrevPage: z.boolean(),
          }),
        }).optional(),
      }),
      "Album retrieved successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album not found",
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

// GET favorited images for a client
export const getFavoriteImagesRoute = createRoute({
  tags: ["Public"],
  method: "get",
  summary: "Get favorited images for client",
  description: "Retrieve only images favorited by a specific client",
  path: "/share/:token/favorites",
  request: {
    params: z.object({
      token: z.string(),
    }),
    query: z.object({
      clientName: z.string().min(1).max(255),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.array(imageSchema).optional(),
      }),
      "Favorite images retrieved successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album not found",
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

// POST create favorite
export const createFavoriteRoute = createRoute({
  tags: ["Public"],
  method: "post",
  summary: "Create favorite",
  description: "Add a photo to favorites",
  path: "/share/:token/favorites",
  request: {
    params: z.object({
      token: z.string(),
    }),
    body: jsonContent(
      createFavoriteSchema,
      "Favorite data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      favoriteResponseSchema,
      "Favorite created successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album or image not found",
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Favorite already exists",
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

// DELETE favorite
export const deleteFavoriteRoute = createRoute({
  tags: ["Public"],
  method: "delete",
  summary: "Delete favorite",
  description: "Remove a photo from favorites (only by the same clientName that created it)",
  path: "/share/:token/favorites/:favoriteId",
  request: {
    params: z.object({
      token: z.string(),
      favoriteId: z.string(),
    }),
    body: jsonContent(
      deleteFavoriteSchema,
      "Client name for verification",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Favorite deleted successfully",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Client name does not match",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Favorite not found",
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

// PATCH update notes on favorite
export const updateNotesRoute = createRoute({
  tags: ["Public"],
  method: "patch",
  summary: "Update notes on favorite",
  description: "Update notes for a favorited photo (only by the same clientName that created it)",
  path: "/share/:token/favorites/:favoriteId/notes",
  request: {
    params: z.object({
      token: z.string(),
      favoriteId: z.string(),
    }),
    body: jsonContent(
      updateNotesSchema,
      "Notes data",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      favoriteResponseSchema,
      "Notes updated successfully",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Client name does not match",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Favorite not found",
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

export type GetAlbumByTokenRoute = typeof getAlbumByTokenRoute;
export type GetFavoriteImagesRoute = typeof getFavoriteImagesRoute;
export type CreateFavoriteRoute = typeof createFavoriteRoute;
export type DeleteFavoriteRoute = typeof deleteFavoriteRoute;
export type UpdateNotesRoute = typeof updateNotesRoute;
