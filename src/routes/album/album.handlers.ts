import { createDb } from "@/db";
import { albums, images, favorites } from "@/db/schema/albums";
import type { AppRouteHandler } from "@/lib/types";
import { eq, desc, and } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateAlbumRoute, GenerateUploadUrlRoute, ListAlbumsRoute, ConfirmUploadRoute, GetAlbumImagesRoute, DeleteImageRoute, BulkDeleteImagesRoute, GetAlbumFavoritesRoute, DeleteAlbumRoute, CreateShareLinkRoute } from "./album.routes";
import { useBackBlaze } from "@/lib/backblaze";

// Create or get share link
export const createShareLink: AppRouteHandler<CreateShareLinkRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const webDomain = c.env.WEB_DOMAIN;

    // Check if album exists
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

// Get all albums
export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { getPublicUrl } = await useBackBlaze(c.env);

    const albumList = await db.select().from(albums);

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
            const imageKey = firstImage.thumbnailB2FileName || firstImage.b2FileName;
            return {
              ...album,
              preview_link: imageKey ? getPublicUrl(imageKey) : null,
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
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const { deleteFile } = await useBackBlaze(c.env);

    // Check if album exists
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

    // Get all images in the album to delete from B2
    const albumImages = await db
      .select()
      .from(images)
      .where(eq(images.albumId, albumId));

    // Delete all files from Backblaze B2 (both main images and thumbnails)
    let deletedFiles = 0;
    let failedDeletions = 0;

    for (const image of albumImages) {
      try {
        // Delete main image file
        if (image.b2FileId) {
          await deleteFile(image.b2FileId);
          deletedFiles++;
        }
        // Delete thumbnail file if exists
        if (image.thumbnailB2FileId) {
          await deleteFile(image.thumbnailB2FileId);
          deletedFiles++;
        }
      } catch (deleteError) {
        console.error(`Failed to delete file for image ${image.id}:`, deleteError);
        failedDeletions++;
      }
    }

    // Delete the album (cascade will handle images and favorites)
    await db
      .delete(albums)
      .where(eq(albums.id, albumId));

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
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const query = c.req.valid("query");
    const { getPublicUrl } = await useBackBlaze(c.env);

    // Check if album exists
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

    // Build the query for favorites
    let favoritesQuery = db
      .select({
        id: favorites.id,
        albumId: favorites.albumId,
        imageId: favorites.imageId,
        clientName: favorites.clientName,
        notes: favorites.notes,
        createdAt: favorites.createdAt,
        image: {
          id: images.id,
          albumId: images.albumId,
          b2FileId: images.b2FileId,
          b2FileName: images.b2FileName,
          originalFilename: images.originalFilename,
          fileSize: images.fileSize,
          width: images.width,
          height: images.height,
          uploadOrder: images.uploadOrder,
          uploadStatus: images.uploadStatus,
          thumbnailB2FileId: images.thumbnailB2FileId,
          thumbnailB2FileName: images.thumbnailB2FileName,
          createdAt: images.createdAt,
        }
      })
      .from(favorites)
      .leftJoin(images, eq(favorites.imageId, images.id))
      .where(eq(favorites.albumId, albumId));

    // Filter by client name if provided
    if (query?.clientName) {
      favoritesQuery = favoritesQuery.where(
        and(
          eq(favorites.albumId, albumId),
          eq(favorites.clientName, query.clientName)
        )
      );
    }

    const albumFavorites = await favoritesQuery.orderBy(desc(favorites.createdAt));

    // Add image URLs to the favorites
    const favoritesWithUrls = albumFavorites.map(favorite => {
      if (!favorite.image) return favorite;

      const imageKey = favorite.image.b2FileName;
      const thumbnailKey = favorite.image.thumbnailB2FileName;
      
      return {
        ...favorite,
        image: {
          ...favorite.image,
          url: imageKey ? getPublicUrl(imageKey) : null,
          thumbnailUrl: thumbnailKey ? getPublicUrl(thumbnailKey) : null,
        }
      };
    });

    return c.json(
      {
        success: true,
        message: "Favorites retrieved successfully",
        data: favoritesWithUrls,
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
    const { createId } = await import('@paralleldrive/cuid2');
    const { db } = createDb(c.env);
    const body = c.req.valid("json");
    const id = createId()
    
    // Convert date strings to Date objects if they exist
    const valuesToInsert: any = {
      id,
      title: body.title,
    };
    
    if (body.userId !== undefined) {
      valuesToInsert.userId = body.userId;
    }
    
    if (body.eventDate !== undefined) {
      valuesToInsert.eventDate = body.eventDate;
    }
    
    if (body.expiresAt !== undefined) {
      valuesToInsert.expiresAt = new Date(body.expiresAt);
    }
    
    if (body.isPublic !== undefined) {
      valuesToInsert.isPublic = body.isPublic;
    }
    
    const [newAlbum] = await db
      .insert(albums)
      .values(valuesToInsert)
      .returning();

    return c.json(
      {
        success: true,
        message: "Album entry created successfully",
        data: newAlbum,
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
    const { db } = createDb(c.env);
    const { files } = c.req.valid("json");
    const { albumId } = c.req.valid("param");
    const { getSignedUrls } = await useBackBlaze(c.env)
    const urls = await getSignedUrls(files, albumId)
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
  try {
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const { images: uploadedImages } = c.req.valid("json");

    // Check if album exists
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

    // Save image metadata to database
    const savedImages = await Promise.all(
      uploadedImages.map(async (img) => {
        const key = `${albumId}/${img.filename}`;
        const [savedImage] = await db
          .insert(images)
          .values({
            albumId,
            b2FileId: img.b2FileId,
            b2FileName: key,
            originalFilename: img.filename,
            fileSize: img.fileSize,
            width: img.width,
            height: img.height,
            uploadOrder: img.uploadOrder,
            thumbnailB2FileId: img.thumbnailB2FileId,
            thumbnailB2FileName: img.thumbnailB2FileName,
            uploadStatus: 'complete',
          })
          .returning({
            id: images.id,
            originalFilename: images.originalFilename,
            b2FileName: images.b2FileName,
          });
        return savedImage;
      })
    );

    // Update album statistics - need to get fileSize from uploadedImages since we didn't return it
    const totalSize = uploadedImages.reduce((sum, img) => sum + img.fileSize, 0);
    
    // Generate share token if not exists
    let shareToken = album.shareLinkToken;
    if (!shareToken) {
      const { createId } = await import('@paralleldrive/cuid2');
      shareToken = createId();
    }
    
    await db
      .update(albums)
      .set({
        totalImages: album.totalImages + savedImages.length,
        totalSize: album.totalSize + totalSize,
        shareLinkToken: shareToken,
        updatedAt: new Date(),
      })
      .where(eq(albums.id, albumId));

    return c.json(
      {
        success: true,
        message: "Upload metadata saved successfully",
        data: savedImages,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem saving upload metadata",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

// Get album with all images
export const getAlbumImages: AppRouteHandler<GetAlbumImagesRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const { getPublicUrl } = await useBackBlaze(c.env);

    // Get album by ID
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
      const imageKey = firstImage.thumbnailB2FileName || firstImage.b2FileName;
      previewLink = imageKey ? getPublicUrl(imageKey) : null;
    }

    // Add image URLs to the images array
    const imagesWithUrls = albumImages.map(image => {
      const imageKey = image.b2FileName;
      const thumbnailKey = image.thumbnailB2FileName;
      return {
        ...image,
        url: imageKey ? getPublicUrl(imageKey) : null,
        thumbnailUrl: thumbnailKey ? getPublicUrl(thumbnailKey) : null,
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
    const { db } = createDb(c.env);
    const { albumId, imageId } = c.req.valid("param");
    const { deleteFile } = await useBackBlaze(c.env);

    // Verify album exists
    const [album] = await db
      .select({ totalSize: albums.totalSize, totalImages: albums.totalImages })
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
      if (image.b2FileId) {
        await deleteFile(image.b2FileId);
      }
      if (image.thumbnailB2FileId) {
        await deleteFile(image.thumbnailB2FileId);
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
    const { db } = createDb(c.env);
    const { albumId } = c.req.valid("param");
    const { imageIds } = c.req.valid("json");
    const { deleteFile } = await useBackBlaze(c.env);

    // Verify album exists
    const [album] = await db
      .select({ totalSize: albums.totalSize, totalImages: albums.totalImages })
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
        if (image.b2FileId) {
          await deleteFile(image.b2FileId);
        }
        if (image.thumbnailB2FileId) {
          await deleteFile(image.thumbnailB2FileId);
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