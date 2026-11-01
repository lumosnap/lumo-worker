import { albums, images, favorites, albumSets, albumPeople, imagePeople, clientPeople } from "@/db/d1-schema/albums";
import { subscriptions, plans } from "@/db/d1-schema/billing";
import { profiles } from "@/db/d1-schema/profiles";
import type { AppRouteHandler } from "@/lib/types";
import { eq, desc, and, sql, gt } from 'drizzle-orm';
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateAlbumRoute, GenerateUploadUrlRoute, ListAlbumsRoute, ConfirmUploadRoute, UpdateImagesRoute, UpdateImageBrowseRoute, GetAlbumImagesRoute, DeleteImageRoute, BulkDeleteImagesRoute, GetAlbumFavoritesRoute, DeleteAlbumRoute, CreateShareLinkRoute, PutAlbumSetsRoute, GetAlbumSetsRoute, PutAlbumPeopleRoute, GetAlbumPeopleRoute, PutClientPersonRoute, VectorsUploadUrlRoute, PutAlbumVectorsRoute, DeleteAlbumVectorsRoute } from "./album.routes";
import { useBackBlaze } from "@/lib/backblaze";
import { GLOBAL_MAX_IMAGES } from "@/lib/constants";
import { getOwnedAlbum } from "@/lib/album-access";
import { loadAlbumSets } from "@/lib/album-sets";
import { loadAlbumPeople } from "@/lib/album-people";

// Tags are stored space-joined; undefined leaves the column untouched, null or [] clears it.
const joinTags = (tags: string[] | null | undefined) =>
  tags === undefined ? undefined : tags?.length ? tags.join(' ') : null;

// Create or get share link
export const createShareLink: AppRouteHandler<CreateShareLinkRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const webDomain = c.env.WEB_DOMAIN;

  // Check if album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Check if share link already exists
  if (album.shareLinkToken) {
    const shareLink = `${webDomain}/share/${album.shareLinkToken}`;
    return c.json(
      {
        success: true,
        message: "Share link already exists",
        data: {
          shareLink,
          shareLinkToken: album.shareLinkToken,
        },
      },
      HttpStatusCodes.OK
    );
  }

  // Generate new share token
  const { createId } = await import('@paralleldrive/cuid2');
  const shareLinkToken = createId();

  // Update album with share token
  await db
    .update(albums)
    .set({
      shareLinkToken,
      updatedAt: new Date(),
    })
    .where(eq(albums.id, albumId));

  const shareLink = `${webDomain}/share/${shareLinkToken}`;

  return c.json(
    {
      success: true,
      message: "Share link created successfully",
      data: {
        shareLink,
        shareLinkToken,
      },
    },
    HttpStatusCodes.CREATED
  );
};

// Get all albums for authenticated user
export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { getPublicUrl } = await useBackBlaze(c.env);

  // Limit albums to prevent unbounded queries
  const albumList = await db
    .select()
    .from(albums)
    .where(eq(albums.userId, user.id))
    .orderBy(desc(albums.createdAt))
    .limit(50);

  // Add preview link to each album if it has images
  const results = await Promise.all(
    albumList.map(async (album) => {
      if (album.totalImages > 0) {
        // Get the first image for the album (ordered by uploadOrder, descending)
        const [firstImage] = await db
          .select()
          .from(images)
          .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')))
          .orderBy(desc(images.uploadOrder))
          .limit(1);

        // Add preview link if we found an image
        if (firstImage) {
          // Use thumbnail if available, otherwise use main image
          const imageKey = firstImage.thumbnailB2FileName ? firstImage.thumbnailB2FileName : firstImage.b2FileName;
          return {
            ...album,
            preview_link: imageKey ? getPublicUrl(imageKey, album.isSecondaryStorage!) : null,
          };
        }
      }

      // No images or album is empty
      return {
        ...album,
        preview_link: null,
      };
    })
  );

  return c.json(
    {
      success: true,
      message: "Albums fetched successfully",
      data: results,
    },
    HttpStatusCodes.OK
  );
};

// Delete entire album
export const deleteAlbum: AppRouteHandler<DeleteAlbumRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { deleteFile } = await useBackBlaze(c.env);

  // Check if album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Get all images in the album to delete from B2
  const albumImages = await db
    .select()
    .from(images)
    .where(eq(images.albumId, albumId));

  // Delete all files from Backblaze B2 (both main images and thumbnails)
  // Use batched parallel deletion to avoid CPU time limits
  let deletedFiles = 0;
  let failedDeletions = 0;
  const BATCH_SIZE = 10;

  // Collect all file names to delete
  const fileNamesToDelete: string[] = [];
  if (album.vectorsKey) fileNamesToDelete.push(album.vectorsKey);
  if (album.vectorsPrevKey) fileNamesToDelete.push(album.vectorsPrevKey);
  for (const image of albumImages) {
    if (image.b2FileName) fileNamesToDelete.push(image.b2FileName);
    if (image.thumbnailB2FileName) fileNamesToDelete.push(image.thumbnailB2FileName);
  }

  // Delete in batches
  for (let i = 0; i < fileNamesToDelete.length; i += BATCH_SIZE) {
    const batch = fileNamesToDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(fileName => deleteFile(fileName, album.isSecondaryStorage!))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deletedFiles++;
      } else {
        console.error('Failed to delete file:', result.reason);
        failedDeletions++;
      }
    }
  }

  // Delete the album (cascade will handle images and favorites)
  await db
    .delete(albums)
    .where(eq(albums.id, albumId));

  // Update profile's totalImages only if profile exists
  const [existingProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  if (existingProfile) {
    await db
      .update(profiles)
      .set({
        totalImages: sql`MAX(0, ${profiles.totalImages} - ${albumImages.length})`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id));
  }

  console.log(`Album ${albumId} deleted. Files deleted: ${deletedFiles}, Failed: ${failedDeletions}`);

  return c.json(
    {
      success: true,
      message: "Album deleted successfully",
    },
    HttpStatusCodes.OK
  );
};

// Get album favorites
export const getAlbumFavorites: AppRouteHandler<GetAlbumFavoritesRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const query = c.req.valid("query") || {};
  const { getPublicUrl } = await useBackBlaze(c.env);

  // Check if album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Build the base conditions
  const conditions = [eq(favorites.albumId, albumId)];

  // Add client name filter if provided
  if (query.clientName) {
    conditions.push(eq(favorites.clientName, query.clientName));
  }

  // Get all favorites for this album
  const allFavorites = await db
    .select()
    .from(favorites)
    .where(and(...conditions));

  // Extract unique clientNames
  const uniqueClientNames = [...new Set(allFavorites.map(fav => fav.clientName))];

  // If no favorites, return empty array
  if (allFavorites.length === 0) {
    return c.json(
      {
        success: true,
        message: "Favorites retrieved successfully",
        data: [],
        clientNames: [],
        clients: [],
      },
      HttpStatusCodes.OK
    );
  }

  // Get unique image IDs from favorites
  const imageIds = [...new Set(allFavorites.map(fav => fav.imageId).filter(Boolean))];

  // Get the images
  const favoritedImages = await db
    .select({
      id: images.id,
      b2FileName: images.b2FileName,
      originalFilename: images.originalFilename,
      width: images.width,
      height: images.height,
      createdAt: images.createdAt,
      thumbnailB2FileId: images.thumbnailB2FileId,
      thumbnailB2FileName: images.thumbnailB2FileName,
    })
    .from(images)
    .where(and(eq(images.albumId, albumId), eq(images.uploadStatus, 'complete')));

  // Filter to only images that have favorites
  const filteredImages = favoritedImages.filter(img => imageIds.includes(img.id));

  // Build a map of imageId to favorites
  const favoritesByImage = new Map<number, typeof allFavorites>();
  for (const fav of allFavorites) {
    if (fav.imageId !== null) {
      if (!favoritesByImage.has(fav.imageId)) {
        favoritesByImage.set(fav.imageId, []);
      }
      favoritesByImage.get(fav.imageId)!.push(fav);
    }
  }

  // Generate images with favorite data (same format as public route)
  const imagesWithFavoriteData = await Promise.all(
    filteredImages.map(async (img) => {
      const imageFavorites = favoritesByImage.get(img.id) || [];

      // Build comments array (all favorites for this image)
      const comments = imageFavorites.map((fav) => ({
        clientName: fav.clientName,
        notes: fav.notes,
        createdAt: fav.createdAt,
      }));

      // Count of favorites with non-empty notes
      const notesCount = imageFavorites.filter((fav) => fav.notes && fav.notes.trim() !== '').length;

      return {
        id: img.id,
        originalFilename: img.originalFilename,
        width: img.width,
        height: img.height,
        createdAt: img.createdAt,
        url: getPublicUrl(img.b2FileName, album.isSecondaryStorage!),
        thumbnailUrl: img.thumbnailB2FileName ? getPublicUrl(img.thumbnailB2FileName, album.isSecondaryStorage!) : null,
        favoriteCount: imageFavorites.length,
        notesCount,
        comments,
      };
    })
  );

  const links = await db
    .select({ clientName: clientPeople.clientName, personId: clientPeople.personId })
    .from(clientPeople)
    .where(eq(clientPeople.albumId, albumId));
  const personByClient = new Map(links.map(l => [l.clientName, l.personId]));

  return c.json(
    {
      success: true,
      message: "Favorites retrieved successfully",
      data: imagesWithFavoriteData,
      clientNames: uniqueClientNames,
      clients: uniqueClientNames.map(clientName => ({ clientName, personId: personByClient.get(clientName) ?? null })),
    },
    HttpStatusCodes.OK
  );
};

// Create album
export const createAlbum: AppRouteHandler<CreateAlbumRoute> = async (c) => {
  // Get authenticated user
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const { createId } = await import('@paralleldrive/cuid2');
  const db = c.get('db');
  const body = c.req.valid("json");
  const id = createId();

  // Ensure profile exists
  const [existingProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  if (!existingProfile) {
    await db
      .insert(profiles)
      .values({
        userId: user.id,
        businessName: null,
        phone: null,
        storageUsed: 0,
        totalImages: 0,
      });
  }

  // Use the authenticated user's ID, not the request body
  const valuesToInsert: typeof albums.$inferInsert = {
    id,
    title: body.title,
    userId: user.id,  // Always use authenticated user's ID
  };

  if (body.eventDate !== undefined) {
    valuesToInsert.eventDate = body.eventDate;
  }

  if (body.expiresAt !== undefined) {
    valuesToInsert.expiresAt = new Date(body.expiresAt);
  }

  if (body.isPublic !== undefined) {
    valuesToInsert.isPublic = body.isPublic;
  }

  if (body.isSecondaryStorage !== undefined) {
    valuesToInsert.isSecondaryStorage = body.isSecondaryStorage;
  }

  const [newAlbum] = await db
    .insert(albums)
    .values(valuesToInsert)
    .returning();

  // Add preview_link field (null for new albums)
  const albumResponse = {
    ...newAlbum,
    preview_link: null,
  };

  return c.json(
    {
      success: true,
      message: "Album entry created successfully",
      data: albumResponse,
    },
    HttpStatusCodes.CREATED
  );
};

export const generateUploadUrl: AppRouteHandler<GenerateUploadUrlRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { files } = c.req.valid("json");
  const { albumId } = c.req.valid("param");

  // Check if album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Ensure profile exists
  let [profile] = await db
    .select({ totalImages: profiles.totalImages })
    .from(profiles)
    .where(eq(profiles.userId, user.id));

  if (!profile) {
    await db
      .insert(profiles)
      .values({
        userId: user.id,
        businessName: null,
        phone: null,
        storageUsed: 0,
        totalImages: 0,
      });
    profile = { totalImages: 0 };
  }

  // Verify Plan Limits
  // Fetch user's active subscription and plan
  const [subscription] = await db
    .select({
      status: subscriptions.status,
      imageLimit: plans.imageLimit,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(
      eq(subscriptions.userId, user.id),
      eq(subscriptions.status, 'active'),
      gt(subscriptions.currentPeriodEnd, new Date())
    ));

  // Default to 500 (Trial) if no active subscription found
  // Ideally we should sync this default with the 'Trial' plan in DB, but hardcoding fallback is safe for now
  const limit = subscription?.imageLimit ?? 500;

  // Check plan specific image limit
  if (profile.totalImages >= limit) {
    return c.json(
      {
        success: false,
        message: `Maximum image limit of ${limit} reached for your current plan. Please upgrade to upload more images.`,
      },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const { getSignedUrls } = await useBackBlaze(c.env)
  const urls = await getSignedUrls(files, albumId, album.isSecondaryStorage!)
  return c.json(
    {
      success: true,
      message: "Urls created successfully",
      data: urls,
    },
    HttpStatusCodes.CREATED
  );
}

export const confirmUpload: AppRouteHandler<ConfirmUploadRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { images: uploadedImages } = c.req.valid("json");

  // Validate uploaded images array
  if (!uploadedImages || uploadedImages.length === 0) {
    return c.json(
      {
        success: false,
        message: "No images provided for confirmation",
      },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  // Check if album exists and user owns it
  let album;
  try {
    const [result] = await db.select().from(albums).where(eq(albums.id, albumId));
    album = result;
  } catch (dbError) {
    c.get("logger").error({ error: dbError }, "Database error fetching album");
    return c.json(
      {
        success: false,
        message: "Unable to verify album. Please try again.",
      },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  if (!album) {
    return c.json(
      {
        success: false,
        message: "Album not found",
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  if (album.userId !== user.id) {
    return c.json(
      {
        success: false,
        message: "Forbidden - you don't own this album",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }

  // Save image metadata to database - handle individual failures gracefully
  const savedImages: { id: number; originalFilename: string; b2FileName: string }[] = [];
  const failedImages: { filename: string; error: string }[] = [];

  for (const img of uploadedImages) {
    try {
      // Validate required fields
      if (!img.key || !img.filename) {
        failedImages.push({
          filename: img.filename || 'unknown',
          error: 'Missing required field: key or filename',
        });
        continue;
      }

      // Validate fileSize is a valid number
      const fileSize = typeof img.fileSize === 'number' && !isNaN(img.fileSize) ? img.fileSize : 0;

      const [savedImage] = await db
        .insert(images)
        .values({
          albumId,
          sourceImageHash: img.sourceImageHash ?? null,
          b2FileName: img.key,
          originalFilename: img.filename,
          fileSize,
          width: img.width ?? 0,
          height: img.height ?? 0,
          uploadOrder: img.uploadOrder ?? 0,
          thumbnailB2FileId: img.thumbnailB2FileId ?? null,
          thumbnailB2FileName: img.thumbnailKey ?? null,
          uploadStatus: 'complete',
          capturedAt: img.capturedAt ?? null,
          burstId: img.burstId ?? null,
          isBurstCover: img.isBurstCover ?? null,
          momentId: img.momentId ?? null,
          phash: img.phash ?? null,
          sharpness: img.sharpness ?? null,
          thumbhash: img.thumbhash ?? null,
          tags: joinTags(img.tags) ?? null,
        })
        .returning({
          id: images.id,
          originalFilename: images.originalFilename,
          b2FileName: images.b2FileName,
        });
      savedImages.push(savedImage);
    } catch (insertError) {
      c.get("logger").error({ error: insertError, filename: img.filename }, "Failed to insert image");
      failedImages.push({
        filename: img.filename || 'unknown',
        error: insertError instanceof Error ? insertError.message : 'Database insert failed',
      });
    }
  }

  // If all images failed, return an error
  if (savedImages.length === 0) {
    return c.json(
      {
        success: false,
        message: "Failed to save any image metadata",
        errors: failedImages,
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  // Calculate total size only from successfully saved images
  const totalSize = uploadedImages
    .filter(img => savedImages.some(saved => saved.b2FileName === img.key))
    .reduce((sum, img) => {
      const size = typeof img.fileSize === 'number' && !isNaN(img.fileSize) ? img.fileSize : 0;
      return sum + size;
    }, 0);

  // Generate share token if not exists
  let shareToken = album.shareLinkToken;
  if (!shareToken) {
    try {
      const { createId } = await import('@paralleldrive/cuid2');
      shareToken = createId();
    } catch (importError) {
      c.get("logger").error({ error: importError }, "Failed to generate share token");
      // Continue without share token - not critical
      shareToken = null;
    }
  }

  // Update album statistics
  try {
    await db
      .update(albums)
      .set({
        totalImages: album.totalImages + savedImages.length,
        totalSize: (album.totalSize || 0) + totalSize,
        shareLinkToken: shareToken,
        updatedAt: new Date(),
      })
      .where(eq(albums.id, albumId));
  } catch (updateError) {
    c.get("logger").error({ error: updateError }, "Failed to update album statistics");
    // Images are saved, but stats update failed - non-critical, continue
  }

  // Update profile's totalImages - ensure profile exists first
  try {
    const [existingProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (existingProfile) {
      await db
        .update(profiles)
        .set({
          totalImages: sql`${profiles.totalImages} + ${savedImages.length}`,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, user.id));
    } else {
      // Create profile if it doesn't exist
      await db
        .insert(profiles)
        .values({
          userId: user.id,
          businessName: null,
          phone: null,
          storageUsed: 0,
          totalImages: savedImages.length,
        });
    }
  } catch (profileError) {
    c.get("logger").error({ error: profileError }, "Failed to update profile");
    // Profile update is non-critical, continue
  }

  // Determine response based on partial success
  if (failedImages.length > 0) {
    return c.json(
      {
        success: true,
        message: `Partially saved: ${savedImages.length} succeeded, ${failedImages.length} failed`,
        data: savedImages,
        errors: failedImages,
      },
      207 as any // Multi-Status for partial success
    );
  }

  return c.json(
    {
      success: true,
      message: "Upload metadata saved successfully",
      data: savedImages,
    },
    HttpStatusCodes.OK
  );
}

export const updateImages: AppRouteHandler<UpdateImagesRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { images: imagesToUpdate } = c.req.valid("json");

  // Check if album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  const { deleteFile } = await useBackBlaze(c.env);

  // Process each image update
  const updatedImages = await Promise.all(
    imagesToUpdate.map(async (img) => {
      // Get existing image
      const [existingImage] = await db
        .select()
        .from(images)
        .where(and(eq(images.id, img.imageId), eq(images.albumId, albumId)));

      if (!existingImage) {
        return null;
      }

      // Calculate size difference for album totalSize
      const sizeDiff = img.fileSize - existingImage.fileSize;

      // Delete old files from Backblaze if filenames changed
      if (img.b2FileName !== existingImage.b2FileName) {
        try {
          await deleteFile(existingImage.b2FileName, album.isSecondaryStorage!);
        } catch (error) {
          c.get("logger").error({ error, b2FileName: existingImage.b2FileName }, "Failed to delete old B2 file");
        }
      }

      if (img.thumbnailB2FileName && img.thumbnailB2FileName !== existingImage.thumbnailB2FileName) {
        try {
          if (existingImage.thumbnailB2FileName) {
            await deleteFile(existingImage.thumbnailB2FileName, album.isSecondaryStorage!);
          }
        } catch (error) {
          c.get("logger").error({ error, thumbnailB2FileName: existingImage.thumbnailB2FileName }, "Failed to delete old B2 thumbnail");
        }
      }

      // Update image record in database
      const [updatedImage] = await db
        .update(images)
        .set({
          sourceImageHash: img.sourceImageHash,
          b2FileName: img.b2FileName,
          fileSize: img.fileSize,
          width: img.width,
          height: img.height,
          thumbnailB2FileId: img.thumbnailB2FileId,
          thumbnailB2FileName: img.thumbnailB2FileName,
          // undefined keys are skipped by drizzle, so omitted fields stay untouched
          capturedAt: img.capturedAt,
          burstId: img.burstId,
          isBurstCover: img.isBurstCover,
          momentId: img.momentId,
          phash: img.phash,
          sharpness: img.sharpness,
          thumbhash: img.thumbhash,
          tags: joinTags(img.tags),
        })
        .where(eq(images.id, img.imageId))
        .returning({
          id: images.id,
          originalFilename: images.originalFilename,
          b2FileName: images.b2FileName,
        });

      return { updatedImage, sizeDiff };
    })
  );

  // Filter out null results (images that weren't found)
  const validUpdates = updatedImages.filter(u => u !== null);

  if (validUpdates.length === 0) {
    return c.json(
      {
        success: false,
        message: "No valid images to update",
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  // Calculate total size difference
  const totalSizeDiff = validUpdates.reduce((sum, u) => sum + u!.sizeDiff, 0);

  // Update album totalSize
  await db
    .update(albums)
    .set({
      totalSize: Math.max(0, (album.totalSize || 0) + totalSizeDiff),
      updatedAt: new Date(),
    })
    .where(eq(albums.id, albumId));

  // Extract updated image data for response
  const responseData = validUpdates.map(u => u!.updatedImage);

  return c.json(
    {
      success: true,
      message: "Images updated successfully",
      data: responseData,
    },
    HttpStatusCodes.OK
  );
}

// Update browse/analysis metadata only. Unlike updateImages this never touches storage.
export const updateImageBrowse: AppRouteHandler<UpdateImageBrowseRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { images: rows } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  // Drizzle skips undefined keys; an item with nothing to set would throw, so drop it.
  const updates = rows.flatMap(({ id, tags, ...rest }) => {
    const fields = { ...rest, tags: joinTags(tags) };
    return Object.values(fields).some(v => v !== undefined)
      ? [db.update(images).set(fields)
          .where(and(eq(images.id, id), eq(images.albumId, albumId)))
          .returning({ id: images.id })]
      : [];
  });

  const touchAlbum = db.update(albums).set({ updatedAt: new Date() }).where(eq(albums.id, albumId));
  const results = await db.batch([touchAlbum, ...updates]);
  const updated = results.slice(1).reduce((n, r) => n + (r as unknown[]).length, 0);

  return c.json(
    { success: true, message: `Updated ${updated} images`, updated },
    HttpStatusCodes.OK
  );
}

// Get album with all images
export const getAlbumImages: AppRouteHandler<GetAlbumImagesRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { getPublicUrl } = await useBackBlaze(c.env);

  // Get album by ID and verify ownership
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Get images for the album
  const albumImages = await db
    .select()
    .from(images)
    .where(and(eq(images.albumId, albumId), eq(images.uploadStatus, 'complete')))
    .orderBy(desc(images.uploadOrder));

  // Get preview link (first image thumbnail or main image)
  let previewLink = null;
  if (albumImages.length > 0) {
    const firstImage = albumImages[0];
    const imageKey = firstImage.thumbnailB2FileName ? firstImage.thumbnailB2FileName : firstImage.b2FileName;
    previewLink = imageKey ? getPublicUrl(imageKey, album.isSecondaryStorage!) : null;
  }

  // Add image URLs to the images array
  const imagesWithUrls = albumImages.map(image => {
    const imageKey = image.b2FileName;
    const thumbnailKey = image.thumbnailB2FileName;
    return {
      id: image.id,
      albumId: image.albumId || albumId, // Ensure albumId is a string
      sourceImageHash: image.sourceImageHash,
      b2FileName: image.b2FileName,
      originalFilename: image.originalFilename,
      fileSize: image.fileSize,
      width: image.width,
      height: image.height,
      uploadOrder: image.uploadOrder,
      uploadStatus: (image.uploadStatus as "pending" | "uploading" | "complete" | "failed" | null) || 'complete', // Ensure uploadStatus is not null
      thumbnailB2FileId: image.thumbnailB2FileId,
      thumbnailB2FileName: image.thumbnailB2FileName,
      createdAt: image.createdAt,
      url: imageKey ? getPublicUrl(imageKey, album.isSecondaryStorage!) : null,
      thumbnailUrl: thumbnailKey ? getPublicUrl(thumbnailKey, album.isSecondaryStorage!) : null,
    };
  });

  // Return album with images
  return c.json(
    {
      success: true,
      message: "Album and images retrieved successfully",
      data: {
        ...album,
        preview_link: previewLink,
        images: imagesWithUrls,
      },
    },
    HttpStatusCodes.OK
  );
};

// Delete a single image
export const deleteImage: AppRouteHandler<DeleteImageRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId, imageId } = c.req.valid("param");
  const { deleteFile } = await useBackBlaze(c.env);

  // Verify album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Get image to delete
  const [image] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, imageId), eq(images.albumId, albumId)));

  if (!image) {
    return c.json(
      {
        success: false,
        message: "Image not found in this album",
      },
      HttpStatusCodes.NOT_FOUND
    );
  }

  // Delete file from Backblaze B2
  try {
    if (image.b2FileName) {
      await deleteFile(image.b2FileName, album.isSecondaryStorage!);
    }
    if (image.thumbnailB2FileName) {
      await deleteFile(image.thumbnailB2FileName, album.isSecondaryStorage!);
    }
  } catch (deleteError) {
    c.get("logger").error({ error: deleteError }, "Failed to delete file from storage");
    // Continue with database deletion even if storage deletion fails
  }

  // Delete image from database
  await db
    .delete(images)
    .where(and(eq(images.id, imageId), eq(images.albumId, albumId)));

  // Update album statistics
  const newTotalImages = Math.max(0, album.totalImages - 1);
  const newTotalSize = Math.max(0, (album.totalSize || 0) - image.fileSize);

  await db
    .update(albums)
    .set({
      totalImages: newTotalImages,
      totalSize: newTotalSize,
      updatedAt: new Date(),
    })
    .where(eq(albums.id, albumId));

  // Update profile's totalImages
  await db
    .update(profiles)
    .set({
      totalImages: sql`MAX(0, ${profiles.totalImages} - 1)`,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  return c.json(
    {
      success: true,
      message: "Image deleted successfully",
    },
    HttpStatusCodes.OK
  );
};

// Delete multiple images
export const bulkDeleteImages: AppRouteHandler<BulkDeleteImagesRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      HttpStatusCodes.UNAUTHORIZED
    );
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { imageIds } = c.req.valid("json");
  const { deleteFile } = await useBackBlaze(c.env);

  // Verify album exists and user owns it
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  // Get images to delete
  const imagesToDelete = await db
    .select()
    .from(images)
    .where(and(eq(images.albumId, albumId), eq(images.uploadStatus, 'complete')));

  // Filter images to delete based on provided IDs
  const validImageIds = imageIds.filter(id => imagesToDelete.some(img => img.id === id));
  const imagesToRemove = imagesToDelete.filter(img => validImageIds.includes(img.id));

  let deletedCount = 0;
  let totalSizeReduced = 0;

  // Delete files from Backblaze and database
  for (const image of imagesToRemove) {
    try {
      // Delete file from Backblaze B2
      if (image.b2FileName) {
        await deleteFile(image.b2FileName, album.isSecondaryStorage!);
      }
      if (image.thumbnailB2FileName) {
        await deleteFile(image.thumbnailB2FileName, album.isSecondaryStorage!);
      }

      // Delete image from database
      await db.delete(images).where(eq(images.id, image.id));

      deletedCount++;
      totalSizeReduced += image.fileSize;
    } catch (deleteError) {
      c.get("logger").error({ error: deleteError, imageId: image.id }, "Failed to delete image");
      // Continue with other images
    }
  }

  // Update album statistics
  const newTotalImages = Math.max(0, album.totalImages - deletedCount);
  const newTotalSize = Math.max(0, (album.totalSize || 0) - totalSizeReduced);

  await db
    .update(albums)
    .set({
      totalImages: newTotalImages,
      totalSize: newTotalSize,
      updatedAt: new Date(),
    })
    .where(eq(albums.id, albumId));

  // Update profile's totalImages
  await db
    .update(profiles)
    .set({
      totalImages: sql`MAX(0, ${profiles.totalImages} - ${deletedCount})`,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  return c.json(
    {
      success: true,
      message: "Images deleted successfully",
      data: {
        deletedCount,
        failedCount: imageIds.length - deletedCount,
      },
    },
    HttpStatusCodes.OK
  );
};

// Replace the album's sets wholesale. The desktop app is the source of truth.
export const putAlbumSets: AppRouteHandler<PutAlbumSetsRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { sets } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  // Bound as one JSON parameter. Member position is the index in imageIds, so dropped ids leave harmless gaps.
  const json = JSON.stringify(sets.map(s => ({ ...s, imageIds: [...new Set(s.imageIds)] })));

  // Covers and members are checked against this album's images inside the statements, so an image
  // deleted meanwhile is dropped instead of failing a foreign key. Deleting the sets cascades to their memberships.
  const [, , , members] = await db.batch([
    db.delete(albumSets).where(eq(albumSets.albumId, albumId)),
    db.update(albums).set({ updatedAt: new Date() }).where(eq(albums.id, albumId)),
    db.run(sql`insert into album_sets (album_id, id, name, position, cover_image_id)
      select ${albumId}, s.value ->> 'id', s.value ->> 'name', s.value ->> 'position',
        (select i.id from images i where i.id = s.value ->> 'coverImageId' and i.album_id = ${albumId})
      from json_each(${json}) s`),
    db.run(sql`insert into set_images (album_id, set_id, image_id, position)
      select ${albumId}, s.value ->> 'id', i.id, m.key
      from json_each(${json}) s, json_each(s.value, '$.imageIds') m
      join images i on i.id = m.value and i.album_id = ${albumId}`),
  ]);

  return c.json(
    { success: true, sets: sets.length, memberships: members.meta.changes },
    HttpStatusCodes.OK
  );
}

export const getAlbumSets: AppRouteHandler<GetAlbumSetsRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { albumId } = c.req.valid("param");
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  return c.json({ sets: await loadAlbumSets(c.get('db'), albumId) }, HttpStatusCodes.OK);
}

// JSON array bound as one parameter, so id lists of any length stay under D1's 100-param limit.
const jsonIds = (ids: string[]) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

// Replace the album's people. Rows are upserted (not delete+insert) so client_people links to re-sent ids survive.
export const putAlbumPeople: AppRouteHandler<PutAlbumPeopleRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { people } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  const json = JSON.stringify(people.map(p => ({ ...p, imageIds: [...new Set(p.imageIds)] })));

  // Dropped people cascade to image_people and client links; kept people keep theirs.
  // Covers and members are checked against this album's images inside the statements (see putAlbumSets).
  // "where true" lets SQLite parse the upsert after a select.
  const [, , , , members] = await db.batch([
    db.delete(albumPeople).where(and(eq(albumPeople.albumId, albumId), sql`${albumPeople.id} not in ${jsonIds(people.map(p => p.id))}`)),
    db.delete(imagePeople).where(eq(imagePeople.albumId, albumId)),
    db.update(albums).set({ updatedAt: new Date() }).where(eq(albums.id, albumId)),
    db.run(sql`insert into album_people (album_id, id, name, position, cover_image_id, box)
      select ${albumId}, p.value ->> 'id', p.value ->> 'name', p.value ->> 'position',
        (select i.id from images i where i.id = p.value ->> 'coverImageId' and i.album_id = ${albumId}),
        p.value ->> 'box'
      from json_each(${json}) p where true
      on conflict (album_id, id) do update set name = excluded.name, position = excluded.position,
        cover_image_id = excluded.cover_image_id, box = excluded.box, updated_at = unixepoch()`),
    db.run(sql`insert into image_people (album_id, person_id, image_id)
      select ${albumId}, p.value ->> 'id', i.id
      from json_each(${json}) p, json_each(p.value, '$.imageIds') m
      join images i on i.id = m.value and i.album_id = ${albumId}`),
  ]);

  return c.json(
    { success: true, people: people.length, memberships: members.meta.changes },
    HttpStatusCodes.OK
  );
}

export const getAlbumPeople: AppRouteHandler<GetAlbumPeopleRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { albumId } = c.req.valid("param");
  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  return c.json({ people: await loadAlbumPeople(c.get('db'), albumId) }, HttpStatusCodes.OK);
}

export const putClientPerson: AppRouteHandler<PutClientPersonRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { clientName, personId } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  if (personId === null) {
    await db.delete(clientPeople).where(and(eq(clientPeople.albumId, albumId), eq(clientPeople.clientName, clientName)));
    return c.json({ success: true, clientName, personId }, HttpStatusCodes.OK);
  }

  // One statement, so a people PUT that drops the person can't land between a check and the insert.
  const linked = await db.run(sql`insert into client_people (album_id, client_name, person_id)
    select album_id, ${clientName}, id from album_people where album_id = ${albumId} and id = ${personId}
    on conflict (album_id, client_name) do update set person_id = excluded.person_id`);
  if (!linked.meta.changes) {
    return c.json({ success: false, message: "Person not found in this album" }, HttpStatusCodes.BAD_REQUEST);
  }

  return c.json({ success: true, clientName, personId }, HttpStatusCodes.OK);
}

// Album vector file (LSV1). Content-hash named, so a new upload never overwrites the live one.
export const vectorsUploadUrl: AppRouteHandler<VectorsUploadUrlRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const { albumId } = c.req.valid("param");
  const { hash } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;

  // ponytail: size is validated but not enforced on the PUT; a presigned PUT can't cap Content-Length. Use a presigned POST policy if that matters.
  const { getVectorsUploadUrl } = await useBackBlaze(c.env);
  return c.json(await getVectorsUploadUrl(albumId, hash, owned.album.isSecondaryStorage), HttpStatusCodes.OK);
}

// Best effort: a leftover object only costs storage.
const deleteVectorsObject = async (c: Parameters<AppRouteHandler<PutAlbumVectorsRoute>>[0], key: string, isSecondaryStorage: boolean) => {
  try {
    const { deleteFile } = await useBackBlaze(c.env);
    await deleteFile(key, isSecondaryStorage);
  } catch (error) {
    c.get("logger").error({ error, key }, "Failed to delete vectors object");
  }
}

export const putAlbumVectors: AppRouteHandler<PutAlbumVectorsRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const db = c.get('db');
  const { albumId } = c.req.valid("param");
  const { key, count, model } = c.req.valid("json");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  if (!new RegExp(`^${albumId}/vectors/[a-f0-9]{16,64}\\.bin$`).test(key)) {
    return c.json({ success: false, message: "Key isn't this album's vector file" }, HttpStatusCodes.BAD_REQUEST);
  }

  const { fileExists } = await useBackBlaze(c.env);
  if (!(await fileExists(key, album.isSecondaryStorage))) {
    return c.json({ success: false, message: "Vector file not uploaded" }, HttpStatusCodes.BAD_REQUEST);
  }

  // Compare-and-set on the key we read, so concurrent swaps can't both win and delete each other's file.
  // The replaced file is kept as vectorsPrevKey for share tabs still reading it; the one before that goes.
  const replaced = album.vectorsKey !== key;
  const updated = await db.update(albums)
    .set({
      vectorsKey: key,
      vectorsPrevKey: replaced ? album.vectorsKey : album.vectorsPrevKey,
      vectorsCount: count,
      vectorsModel: model,
      updatedAt: new Date(),
    })
    .where(and(eq(albums.id, albumId), sql`${albums.vectorsKey} is ${album.vectorsKey}`))
    .returning({ id: albums.id });
  if (!updated.length) {
    return c.json({ success: false, message: "Vector file changed meanwhile, retry" }, HttpStatusCodes.CONFLICT);
  }

  const dropped = replaced ? album.vectorsPrevKey : null;
  if (dropped && dropped !== key) await deleteVectorsObject(c, dropped, album.isSecondaryStorage);
  return c.json({ success: true }, HttpStatusCodes.OK);
}

export const deleteAlbumVectors: AppRouteHandler<DeleteAlbumVectorsRoute> = async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const db = c.get('db');
  const { albumId } = c.req.valid("param");

  const owned = await getOwnedAlbum(c, albumId, user.id);
  if (!owned.album) return owned.response;
  const album = owned.album;

  await db.update(albums)
    .set({ vectorsKey: null, vectorsPrevKey: null, vectorsCount: null, vectorsModel: null, updatedAt: new Date() })
    .where(eq(albums.id, albumId));

  for (const key of [album.vectorsKey, album.vectorsPrevKey]) {
    if (key) await deleteVectorsObject(c, key, album.isSecondaryStorage);
  }
  return c.json({ success: true }, HttpStatusCodes.OK);
}
