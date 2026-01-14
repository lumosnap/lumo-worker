import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";


const albumSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  title: z.string(),
  eventDate: z.string().nullable(),
  totalImages: z.number().int(),
  totalSize: z.number().nullable(),
  shareLinkToken: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isPublic: z.boolean().nullable(),
  isSecondaryStorage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preview_link: z.string().url().nullable(),
});

const createAlbumSchema = z.object({
  title: z.string().min(1).max(255).describe("The title of the album."),
  userId: z.string().optional().describe("The ID of the user associated with the album."),
  eventDate: z.string().optional().describe("The date of the event (e.g., '2025-12-31')."),
  expiresAt: z.string().datetime().optional().describe("The expiration date for a share link."),
  isPublic: z.boolean().optional().describe("Whether the album is publicly visible."),
  isSecondaryStorage: z.boolean().optional().describe("Whether to use secondary storage for this album.").default(false),
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

const confirmUploadSchema = z.object({
  images: z.array(z.object({
    filename: z.string(),
    sourceImageHash: z.string().nullable().optional(),
    key: z.string(),
    fileSize: z.number(),
    width: z.number(),
    height: z.number(),
    uploadOrder: z.number(),
    thumbnailB2FileId: z.string().nullable().optional(),
    thumbnailKey: z.string().nullable().optional(),
  }))
});

const confirmUploadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(z.object({
    id: z.number(),
    originalFilename: z.string(),
    b2FileName: z.string(),
  })).optional()
})

const updateImagesSchema = z.object({
  images: z.array(z.object({
    imageId: z.number(),
    sourceImageHash: z.string().nullable().optional(),
    b2FileName: z.string(),
    fileSize: z.number(),
    width: z.number(),
    height: z.number(),
    thumbnailB2FileId: z.string().nullable().optional(),
    thumbnailB2FileName: z.string().nullable().optional(),
  }))
});

const updateImagesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(z.object({
    id: z.number(),
    originalFilename: z.string(),
    b2FileName: z.string(),
  })).optional()
})

const imageSchema = z.object({
  id: z.number(),
  albumId: z.string().nullable(),
  sourceImageHash: z.string().nullable(),
  b2FileName: z.string(),
  originalFilename: z.string(),
  fileSize: z.number(),
  width: z.number(),
  height: z.number(),
  uploadOrder: z.number(),
  uploadStatus: z.enum(['pending', 'uploading', 'complete', 'failed']).nullable(),
  thumbnailB2FileId: z.string().nullable(),
  thumbnailB2FileName: z.string().nullable(),
  createdAt: z.string().datetime(),
  url: z.string().url().nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
});

const albumWithImagesSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  title: z.string(),
  eventDate: z.string().nullable(),
  totalImages: z.number().int(),
  totalSize: z.number().nullable(),
  shareLinkToken: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isPublic: z.boolean().nullable(),
  isSecondaryStorage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preview_link: z.string().url().nullable(),
  images: z.array(imageSchema),
});

const albumImagesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: albumWithImagesSchema.optional(),
});

const deleteImageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const bulkDeleteImagesSchema = z.object({
  imageIds: z.array(z.number().int()).min(1),
});

const bulkDeleteImagesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    deletedCount: z.number(),
    failedCount: z.number(),
  }).optional(),
});

const commentSchema = z.object({
  clientName: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const favoriteImageSchema = z.object({
  id: z.number(),
  originalFilename: z.string(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string().datetime(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  favoriteCount: z.number(),
  notesCount: z.number(),
  comments: z.array(commentSchema),
});

const favoritesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(favoriteImageSchema).optional(),
  clientNames: z.array(z.string()),
});

const createShareLinkResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    shareLink: z.string().url(),
    shareLinkToken: z.string(),
  }).optional(),
});

const shareLinkExistsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    shareLink: z.string().url(),
    shareLinkToken: z.string(),
  }).optional(),
});


// ==================================================
// Routes
// ==================================================


// POST create or get share link
export const createShareLinkRoute = createRoute({
  tags: ["Albums"],
  method: "post",
  summary: "Create or get share link",
  description: "Create a new share link for an album or return existing one",
  path: "/albums/:albumId/share-link",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createShareLinkResponseSchema,
      "Share link created or retrieved successfully",
    ),
    [HttpStatusCodes.CREATED]: jsonContent(
      createShareLinkResponseSchema,
      "Share link created successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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

// GET all albums
export const listAlbumsRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get all album entries",
  description: "Retrieve all entries from albums table for the authenticated user",
  path: "/albums",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      albumListResponseSchema,
      "Album entries retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
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
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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
})

export const confirmUploadRoute = createRoute({
  tags: ["Albums"],
  method: "post",
  summary: "Confirm upload completion",
  description: "Save upload metadata after files are successfully uploaded to storage.",
  path: "/albums/:albumId/confirm-upload",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      confirmUploadSchema,
      "Upload metadata to save",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      confirmUploadResponseSchema,
      "Upload metadata saved successfully",
    ),
    207: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.array(z.object({
          id: z.number(),
          originalFilename: z.string(),
          b2FileName: z.string(),
        })).optional(),
        errors: z.array(z.object({
          filename: z.string(),
          error: z.string(),
        })).optional(),
      }),
      "Partial success - some images saved, some failed",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Invalid request - no images provided",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album not found",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
        errors: z.array(z.object({
          filename: z.string(),
          error: z.string(),
        })).optional(),
      }),
      "Failed to save any image metadata",
    ),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Database temporarily unavailable",
    ),
  },
})

export const updateImagesRoute = createRoute({
  tags: ["Albums"],
  method: "patch",
  summary: "Update existing images",
  description: "Update image metadata after re-uploading files to storage. Old files will be deleted from Backblaze.",
  path: "/albums/:albumId/images",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      updateImagesSchema,
      "Image metadata to update",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      updateImagesResponseSchema,
      "Images updated successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album or image not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Internal server error",
    ),
  },
})

export const getAlbumImagesRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get album with images",
  description: "Retrieve an album and all its images (authenticated users only)",
  path: "/albums/:albumId/images",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      albumImagesResponseSchema,
      "Album and images retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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

export const deleteImageRoute = createRoute({
  tags: ["Albums"],
  method: "delete",
  summary: "Delete image",
  description: "Delete a specific image from an album",
  path: "/albums/:albumId/images/:imageId",
  request: {
    params: z.object({
      albumId: z.string(),
      imageId: z.string().transform(val => parseInt(val)),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      deleteImageResponseSchema,
      "Image deleted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "Album or image not found",
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

export const bulkDeleteImagesRoute = createRoute({
  tags: ["Albums"],
  method: "delete",
  summary: "Delete multiple images",
  description: "Delete multiple images from an album",
  path: "/albums/:albumId/images",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      bulkDeleteImagesSchema,
      "Array of image IDs to delete",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      bulkDeleteImagesResponseSchema,
      "Images deleted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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

export const getAlbumFavoritesRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get album favorites",
  description: "Retrieve all favorites for an album with image details",
  path: "/albums/:albumId/favorites",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    query: z.object({
      clientName: z.string().optional().describe("Filter favorites by client name"),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      favoritesResponseSchema,
      "Favorites retrieved successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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

export const deleteAlbumRoute = createRoute({
  tags: ["Albums"],
  method: "delete",
  summary: "Delete album",
  description: "Delete an album and all its images (including files from B2 storage)",
  path: "/albums/:albumId",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      deleteImageResponseSchema,
      "Album deleted successfully",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      "User doesn't own this album",
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

export type CreateShareLinkRoute = typeof createShareLinkRoute;
export type ListAlbumsRoute = typeof listAlbumsRoute;
export type CreateAlbumRoute = typeof createAlbumRoute;
export type GenerateUploadUrlRoute = typeof generateUploadUrlRoute;
export type ConfirmUploadRoute = typeof confirmUploadRoute;
export type UpdateImagesRoute = typeof updateImagesRoute;
export type GetAlbumImagesRoute = typeof getAlbumImagesRoute;
export type DeleteImageRoute = typeof deleteImageRoute;
export type BulkDeleteImagesRoute = typeof bulkDeleteImagesRoute;
export type GetAlbumFavoritesRoute = typeof getAlbumFavoritesRoute;
export type DeleteAlbumRoute = typeof deleteAlbumRoute;
