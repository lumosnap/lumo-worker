import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { bookingSchema, commentSchema, errorResponseSchema } from "@/lib/openapi-schemas";

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

// Routes

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
      limit: z.string().optional().transform((val) => val ? parseInt(val) : 80),
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
            browseV2: z.boolean(),
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
      errorResponseSchema,
      "Album not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// GET compact album manifest for the browse UI (viewer-independent, cacheable)
export const getShareManifestRoute = createRoute({
  tags: ["Public"],
  method: "get",
  summary: "Get album manifest by share token",
  description: "Compact, viewer-independent list of all complete images in upload order. Supports If-None-Match.",
  path: "/share/:token/manifest",
  request: {
    params: z.object({
      token: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        v: z.literal(1),
        album: z.object({
          id: z.string(),
          title: z.string(),
          eventDate: z.string().nullable(),
          totalImages: z.number(),
          ownerName: z.string().nullable(),
          browseV2: z.boolean(),
        }),
        base: z.string(),
        images: z.array(z.object({
          id: z.number(),
          f: z.string().describe("b2FileName"),
          t: z.string().nullable().describe("thumbnailB2FileName"),
          w: z.number(),
          h: z.number(),
          o: z.number().describe("uploadOrder"),
          c: z.number().nullable().describe("capturedAt, unix ms"),
          b: z.string().nullable().describe("burstId"),
          bc: z.boolean().describe("isBurstCover"),
          m: z.string().nullable().describe("momentId"),
          th: z.string().nullable().describe("thumbhash"),
          g: z.array(z.string()).nullable().describe("tag slugs"),
        })),
        sets: z.array(z.object({
          id: z.string(),
          name: z.string(),
          cover: z.number().nullable().describe("coverImageId"),
          ids: z.array(z.number()).describe("image ids in set order"),
        })).describe("Photographer-defined sets, ordered by position"),
        people: z.array(z.object({
          id: z.string(),
          name: z.string(),
          cover: z.number().nullable().describe("coverImageId"),
          box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().describe("face box on cover, normalized [x,y,w,h]"),
          ids: z.array(z.number()).describe("image ids"),
        })).describe("Recognized people, ordered by position"),
        lists: z.array(z.object({
          id: z.string(),
          name: z.string(),
          maxPicks: z.number().nullable(),
          deadline: z.number().nullable().describe("unix ms"),
          setLimits: z.array(z.object({ setId: z.string(), max: z.number() })).nullable(),
        })).describe("Selection lists, ordered by position"),
        vectors: z.object({
          url: z.string(),
          count: z.number(),
          model: z.string(),
        }).nullable().describe("Album vector file (LSV1), immutable at its URL"),
      }),
      "Album manifest",
    ),
    [HttpStatusCodes.NOT_MODIFIED]: {
      description: "Manifest unchanged since the given ETag",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album not found",
    ),
  },
});

// GET favorites and comments for a client (viewer-specific, uncached)
export const getShareFeedbackRoute = createRoute({
  tags: ["Public"],
  method: "get",
  summary: "Get feedback for share token",
  description: "Image IDs favorited by clientName, plus all comments keyed by image ID",
  path: "/share/:token/feedback",
  request: {
    params: z.object({
      token: z.string(),
    }),
    query: z.object({
      clientName: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        favorites: z.array(z.number()),
        counts: z.record(z.string(), z.number()).describe("favorite count per image ID, all clients"),
        comments: z.record(z.string(), z.array(commentSchema)),
        lists: z.record(z.string(), z.object({
          imageIds: z.array(z.number()),
          submittedAt: z.number().nullable().describe("unix ms"),
        })).describe("clientName's picks per selection list id"),
      }),
      "Feedback retrieved successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album not found",
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
      errorResponseSchema,
      "Album not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "Album or image not found",
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      errorResponseSchema,
      "Favorite already exists",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "Favorite deleted successfully",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "Client name does not match",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Favorite not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "Client name does not match",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Favorite not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// PATCH batch favorites
const batchFavoritesSchema = z.object({
  clientName: z.string().min(1).max(255),
  changes: z.array(z.object({
    imageId: z.number(),
    action: z.enum(['favorite', 'unfavorite', 'comment']),
    notes: z.string().optional(),
  })),
});

const batchFavoritesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  results: z.array(z.object({
    imageId: z.number(),
    success: z.boolean(),
    message: z.string().optional(),
  })),
});

export const batchFavoritesRoute = createRoute({
  tags: ["Public"],
  method: "patch",
  summary: "Batch favorite operations",
  description: "Perform multiple favorite/unfavorite/comment operations at once",
  path: "/share/:token/favorites/batch",
  request: {
    params: z.object({
      token: z.string(),
    }),
    body: jsonContent(
      batchFavoritesSchema,
      "Batch operations",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      batchFavoritesResponseSchema,
      "Batch operations completed",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

const clientNameSchema = z.string().min(1).max(255);
const listParams = z.object({ token: z.string(), listId: z.string() });
const lockedSchema = z.object({ error: z.literal('locked') });

export const putListPicksRoute = createRoute({
  tags: ["Public"],
  method: "post",
  summary: "Change a client's picks in a selection list",
  description: "Applies removes then adds atomically. Rejected whole if the result breaks maxPicks or a set limit. Image ids not in the album are ignored.",
  path: "/share/:token/lists/:listId/picks",
  request: {
    params: listParams,
    body: jsonContent(
      z.object({
        clientName: clientNameSchema,
        add: z.array(z.number().int()).max(500),
        remove: z.array(z.number().int()).max(500),
      }),
      "Pick changes",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ imageIds: z.array(z.number()) }), "The client's full pick list"),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.literal('limit'), maxPicks: z.number().nullable(), setId: z.string().optional(), max: z.number().optional() }),
      "Result would exceed a limit",
    ),
    [HttpStatusCodes.LOCKED]: jsonContent(lockedSchema, "Submitted or past the deadline"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorResponseSchema, "Album or list not found"),
  },
});

export const submitListRoute = createRoute({
  tags: ["Public"],
  method: "post",
  summary: "Submit a client's selection list",
  description: "Locks the client's picks for this list. Idempotent; allowed after the deadline.",
  path: "/share/:token/lists/:listId/submit",
  request: {
    params: listParams,
    body: jsonContent(z.object({ clientName: clientNameSchema }), "Submitting client"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ submittedAt: z.number().describe("unix ms") }), "Submitted"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorResponseSchema, "Album or list not found"),
  },
});

// Photographer details schema
const photographerDetailsSchema = z.object({
  id: z.string(),
  businessName: z.string().nullable(),
  phone: z.string().nullable(),
});

// Booking schemas
const createBookingSchema = z.object({
  eventType: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(20),
  eventDate: z.string(), // ISO date string YYYY-MM-DD
  location: z.string().min(1).max(500),
  details: z.string().optional(),
});

const bookingResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: bookingSchema.optional(),
});

// GET photographer details
export const getPhotographerDetailsRoute = createRoute({
  tags: ["Public"],
  method: "get",
  summary: "Get photographer details",
  description: "Retrieve photographer company name and contact details by user ID",
  path: "/photographer/:photographerId",
  request: {
    params: z.object({
      photographerId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: photographerDetailsSchema.optional(),
      }),
      "Photographer details retrieved successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Photographer not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

// POST create booking
export const createBookingRoute = createRoute({
  tags: ["Public"],
  method: "post",
  summary: "Create a booking",
  description: "Create a new booking request for a photographer",
  path: "/photographer/:photographerId/booking",
  request: {
    params: z.object({
      photographerId: z.string(),
    }),
    body: jsonContent(
      createBookingSchema,
      "Booking data",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      bookingResponseSchema,
      "Booking created successfully",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Photographer not found",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      errorResponseSchema,
      "Invalid booking data",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});

export type GetAlbumByTokenRoute = typeof getAlbumByTokenRoute;
export type GetShareManifestRoute = typeof getShareManifestRoute;
export type GetShareFeedbackRoute = typeof getShareFeedbackRoute;
export type GetFavoriteImagesRoute = typeof getFavoriteImagesRoute;
export type CreateFavoriteRoute = typeof createFavoriteRoute;
export type DeleteFavoriteRoute = typeof deleteFavoriteRoute;
export type UpdateNotesRoute = typeof updateNotesRoute;
export type GetPhotographerDetailsRoute = typeof getPhotographerDetailsRoute;
export type CreateBookingRoute = typeof createBookingRoute;
export type BatchFavoritesRoute = typeof batchFavoritesRoute;
export type PutListPicksRoute = typeof putListPicksRoute;
export type SubmitListRoute = typeof submitListRoute;
