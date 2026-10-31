import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { commentSchema, errorResponseSchema } from "@/lib/openapi-schemas";


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
  isSecondaryStorage: z.boolean().optional().describe("Whether to use secondary storage (Backblaze) for this album. Defaults true — Backblaze is the main provider.").default(true),
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

// Optional browse metadata computed by newer desktop clients; older clients omit it.
const browseImageFields = {
  capturedAt: z.number().nullable().optional().describe("Capture time, unix ms."),
  burstId: z.string().nullable().optional(),
  isBurstCover: z.boolean().nullable().optional(),
  momentId: z.string().nullable().optional(),
  phash: z.string().nullable().optional().describe("16-char hex perceptual hash."),
  sharpness: z.number().nullable().optional(),
  thumbhash: z.string().nullable().optional().describe("Base64 ThumbHash."),
  tags: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(12).nullable().optional().describe("Tag slugs; null clears."),
};

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
    ...browseImageFields,
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
    ...browseImageFields,
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

const updateImageBrowseSchema = z.object({
  images: z.array(z.object({
    id: z.number().int().describe("Server image id."),
    ...browseImageFields,
  })).min(1).max(1000),
});

const updateImageBrowseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  updated: z.number().optional(),
});

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

const deleteImageResponseSchema = errorResponseSchema;

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
  clients: z.array(z.object({
    clientName: z.string(),
    personId: z.string().nullable().describe("Album person this client is linked to"),
  })).optional(),
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


// Routes


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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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
      errorResponseSchema,
      "Invalid request - no images provided",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album or image not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
})

export const updateImageBrowseRoute = createRoute({
  tags: ["Albums"],
  method: "patch",
  summary: "Update image browse metadata",
  description: "Update browse/analysis fields (capture time, bursts, moments, hashes) on existing images. Never touches stored files.",
  path: "/albums/:albumId/images/browse",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      updateImageBrowseSchema,
      "Browse metadata per image",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      updateImageBrowseResponseSchema,
      "Browse metadata updated",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album not found",
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "Album or image not found",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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
      errorResponseSchema,
      "User not authenticated",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      errorResponseSchema,
      "User doesn't own this album",
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

const albumSetSchema = z.object({
  id: z.string().min(1).max(64).describe("Client-generated set id."),
  name: z.string().min(1).max(120),
  position: z.number().int(),
  coverImageId: z.number().int().nullable(),
  imageIds: z.array(z.number().int()).describe("Server image ids, in display order."),
});

const putAlbumSetsSchema = z.object({
  sets: z.array(albumSetSchema).max(200)
    .refine(sets => new Set(sets.map(s => s.id)).size === sets.length, "Duplicate set id"),
});

const putAlbumSetsResponseSchema = z.object({
  success: z.boolean(),
  sets: z.number(),
  memberships: z.number(),
});

const ownerErrorResponses = {
  [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorResponseSchema, "User not authenticated"),
  [HttpStatusCodes.FORBIDDEN]: jsonContent(errorResponseSchema, "User doesn't own this album"),
  [HttpStatusCodes.NOT_FOUND]: jsonContent(errorResponseSchema, "Album not found"),
};

export const putAlbumSetsRoute = createRoute({
  tags: ["Albums"],
  method: "put",
  summary: "Replace album sets",
  description: "Atomically replace all photographer-defined sets of an album. Image ids not in this album are dropped.",
  path: "/albums/:albumId/sets",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(putAlbumSetsSchema, "The album's complete set structure"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(putAlbumSetsResponseSchema, "Sets replaced"),
    ...ownerErrorResponses,
  },
})

export const getAlbumSetsRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get album sets",
  description: "All photographer-defined sets of an album, ordered by position.",
  path: "/albums/:albumId/sets",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ sets: z.array(albumSetSchema) }), "Album sets"),
    ...ownerErrorResponses,
  },
})

const albumPersonSchema = z.object({
  id: z.string().min(1).max(64).describe("Client-generated person id."),
  name: z.string().min(1).max(80),
  position: z.number().int(),
  coverImageId: z.number().int().nullable(),
  box: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])
    .nullable().describe("Face box on the cover image, normalized [x,y,w,h]."),
  imageIds: z.array(z.number().int()).describe("Server image ids this person appears in."),
});

const putAlbumPeopleSchema = z.object({
  people: z.array(albumPersonSchema).max(300)
    .refine(people => new Set(people.map(p => p.id)).size === people.length, "Duplicate person id"),
});

export const putAlbumPeopleRoute = createRoute({
  tags: ["Albums"],
  method: "put",
  summary: "Replace album people",
  description: "Atomically replace an album's people. Re-sent ids keep their client links; image ids not in this album are dropped.",
  path: "/albums/:albumId/people",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(putAlbumPeopleSchema, "The album's complete people list"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ success: z.boolean(), people: z.number(), memberships: z.number() }),
      "People replaced",
    ),
    ...ownerErrorResponses,
  },
})

export const getAlbumPeopleRoute = createRoute({
  tags: ["Albums"],
  method: "get",
  summary: "Get album people",
  description: "All people of an album, ordered by position.",
  path: "/albums/:albumId/people",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ people: z.array(albumPersonSchema) }), "Album people"),
    ...ownerErrorResponses,
  },
})

export const putClientPersonRoute = createRoute({
  tags: ["Albums"],
  method: "put",
  summary: "Link a client to a person",
  description: "Link a share-link client name to one of the album's people, or unlink with personId null.",
  path: "/albums/:albumId/client-people",
  request: {
    params: z.object({
      albumId: z.string(),
    }),
    body: jsonContent(
      z.object({ clientName: z.string().min(1).max(255), personId: z.string().nullable() }),
      "Client link",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ success: z.boolean(), clientName: z.string(), personId: z.string().nullable() }),
      "Client link saved",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorResponseSchema, "Person not in this album"),
    ...ownerErrorResponses,
  },
})

export const vectorsUploadUrlRoute = createRoute({
  tags: ["Albums"],
  method: "post",
  summary: "Get an upload URL for the album vector file",
  description: "Presigned PUT for `{albumId}/vectors/{hash}.bin`. Send exactly the returned headers with the PUT, then record it with PUT /albums/:albumId/vectors.",
  path: "/albums/:albumId/vectors/upload-url",
  request: {
    params: z.object({ albumId: z.string() }),
    body: jsonContent(
      z.object({
        hash: z.string().regex(/^[a-f0-9]{16,64}$/).describe("Content hash, lowercase hex"),
        size: z.number().int().min(1).max(64 * 1024 * 1024).describe("Bytes"),
      }),
      "Vector file to upload",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ url: z.string(), key: z.string(), headers: z.record(z.string(), z.string()) }),
      "Presigned upload",
    ),
    ...ownerErrorResponses,
  },
})

export const putAlbumVectorsRoute = createRoute({
  tags: ["Albums"],
  method: "put",
  summary: "Record the album vector file",
  description: "Point the album at an uploaded vector file. The previous file is deleted from storage.",
  path: "/albums/:albumId/vectors",
  request: {
    params: z.object({ albumId: z.string() }),
    body: jsonContent(
      z.object({
        key: z.string().max(200),
        count: z.number().int().min(0),
        model: z.string().min(1).max(32),
      }),
      "Uploaded vector file",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ success: z.boolean() }), "Recorded"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorResponseSchema, "Key isn't this album's vector file"),
    ...ownerErrorResponses,
  },
})

export const deleteAlbumVectorsRoute = createRoute({
  tags: ["Albums"],
  method: "delete",
  summary: "Clear the album vector file",
  path: "/albums/:albumId/vectors",
  request: {
    params: z.object({ albumId: z.string() }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ success: z.boolean() }), "Cleared"),
    ...ownerErrorResponses,
  },
})

export type CreateShareLinkRoute = typeof createShareLinkRoute;
export type ListAlbumsRoute = typeof listAlbumsRoute;
export type CreateAlbumRoute = typeof createAlbumRoute;
export type GenerateUploadUrlRoute = typeof generateUploadUrlRoute;
export type ConfirmUploadRoute = typeof confirmUploadRoute;
export type UpdateImagesRoute = typeof updateImagesRoute;
export type UpdateImageBrowseRoute = typeof updateImageBrowseRoute;
export type GetAlbumImagesRoute = typeof getAlbumImagesRoute;
export type DeleteImageRoute = typeof deleteImageRoute;
export type BulkDeleteImagesRoute = typeof bulkDeleteImagesRoute;
export type GetAlbumFavoritesRoute = typeof getAlbumFavoritesRoute;
export type DeleteAlbumRoute = typeof deleteAlbumRoute;
export type PutAlbumSetsRoute = typeof putAlbumSetsRoute;
export type GetAlbumSetsRoute = typeof getAlbumSetsRoute;
export type PutAlbumPeopleRoute = typeof putAlbumPeopleRoute;
export type GetAlbumPeopleRoute = typeof getAlbumPeopleRoute;
export type PutClientPersonRoute = typeof putClientPersonRoute;
export type VectorsUploadUrlRoute = typeof vectorsUploadUrlRoute;
export type PutAlbumVectorsRoute = typeof putAlbumVectorsRoute;
export type DeleteAlbumVectorsRoute = typeof deleteAlbumVectorsRoute;
