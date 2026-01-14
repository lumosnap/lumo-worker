import { albums, images, favorites } from "@/db/schema/albums";
import { subscriptions, plans } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";
import type { AppRouteHandler } from "@/lib/types";
import { eq, desc, and, sql, gt } from 'drizzle-orm';
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateAlbumRoute, GenerateUploadUrlRoute, ListAlbumsRoute, ConfirmUploadRoute, UpdateImagesRoute, GetAlbumImagesRoute, DeleteImageRoute, BulkDeleteImagesRoute, GetAlbumFavoritesRoute, DeleteAlbumRoute, CreateShareLinkRoute } from "./album.routes";
import { useBackBlaze } from "@/lib/backblaze";
import { GLOBAL_MAX_IMAGES } from "@/lib/constants";

// Create or get share link
export const createShareLink: AppRouteHandler<CreateShareLinkRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
  } catch (error: any) {
    console.error("Error creating share link:", error);
    return c.json(
      {
        success: false,
        message: "Failed to create share link",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get all albums for authenticated user
export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  try {
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
            // Use thumbnail if available (and has file ID), otherwise use main image
            const imageKey = firstImage.thumbnailB2FileId && firstImage.thumbnailB2FileName ? firstImage.thumbnailB2FileName : firstImage.b2FileName;
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem fetching albums",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Delete entire album
export const deleteAlbum: AppRouteHandler<DeleteAlbumRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
          totalImages: sql`GREATEST(0, ${profiles.totalImages} - ${albumImages.length})`,
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem deleting album",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get album favorites
export const getAlbumFavorites: AppRouteHandler<GetAlbumFavoritesRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
          thumbnailUrl: img.thumbnailB2FileId && img.thumbnailB2FileName ? getPublicUrl(img.thumbnailB2FileName, album.isSecondaryStorage!) : null,
          favoriteCount: imageFavorites.length,
          notesCount,
          comments,
        };
      })
    );

    return c.json(
      {
        success: true,
        message: "Favorites retrieved successfully",
        data: imagesWithFavoriteData,
        clientNames: uniqueClientNames,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving favorites",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Create album
export const createAlbum: AppRouteHandler<CreateAlbumRoute> = async (c) => {
  try {
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
    const valuesToInsert: any = {
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
  } catch (error: any) {
    console.log(error)
    return c.json(
      {
        success: false,
        message: "Problem creating album entry",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const generateUploadUrl: AppRouteHandler<GenerateUploadUrlRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
  } catch (error: any) {
    console.log(error)
    return c.json(
      {
        success: false,
        message: "Problem creating album entry",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
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
  } catch (dbError: any) {
    console.error("Database error fetching album:", dbError);
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
        })
        .returning({
          id: images.id,
          originalFilename: images.originalFilename,
          b2FileName: images.b2FileName,
        });
      savedImages.push(savedImage);
    } catch (insertError: any) {
      console.error(`Failed to insert image ${img.filename}:`, insertError);
      failedImages.push({
        filename: img.filename || 'unknown',
        error: insertError?.message || 'Database insert failed',
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
    } catch (importError: any) {
      console.error("Failed to generate share token:", importError);
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
  } catch (updateError: any) {
    console.error("Failed to update album statistics:", updateError);
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
  } catch (profileError: any) {
    console.error("Failed to update profile:", profileError);
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
  try {
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
    const [album] = await db.select().from(albums).where(eq(albums.id, albumId));
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
            console.error(`Failed to delete old B2 file ${existingImage.b2FileName}:`, error);
          }
        }

        if (img.thumbnailB2FileName && img.thumbnailB2FileName !== existingImage.thumbnailB2FileName) {
          try {
            if (existingImage.thumbnailB2FileName) {
              await deleteFile(existingImage.thumbnailB2FileName, album.isSecondaryStorage!);
            }
          } catch (error) {
            console.error(`Failed to delete old B2 thumbnail ${existingImage.thumbnailB2FileName}:`, error);
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating images",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

// Get album with all images
export const getAlbumImages: AppRouteHandler<GetAlbumImagesRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
      const imageKey = firstImage.thumbnailB2FileId && firstImage.thumbnailB2FileName ? firstImage.thumbnailB2FileName : firstImage.b2FileName;
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
        uploadStatus: image.uploadStatus || 'complete', // Ensure uploadStatus is not null
        thumbnailB2FileId: image.thumbnailB2FileId,
        thumbnailB2FileName: image.thumbnailB2FileName,
        createdAt: image.createdAt,
        url: imageKey ? getPublicUrl(imageKey, album.isSecondaryStorage!) : null,
        thumbnailUrl: image.thumbnailB2FileId && thumbnailKey ? getPublicUrl(thumbnailKey, album.isSecondaryStorage!) : null,
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving album and images",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Delete a single image
export const deleteImage: AppRouteHandler<DeleteImageRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
      console.error("Failed to delete file from storage:", deleteError);
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
        totalImages: sql`GREATEST(0, ${profiles.totalImages} - 1)`,
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem deleting image",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Delete multiple images
export const bulkDeleteImages: AppRouteHandler<BulkDeleteImagesRoute> = async (c) => {
  try {
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
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, albumId));

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
        console.error(`Failed to delete image ${image.id}:`, deleteError);
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
        totalImages: sql`GREATEST(0, ${profiles.totalImages} - ${deletedCount})`,
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
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem deleting images",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};