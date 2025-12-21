import { createDb } from "@/db";
import { albums, images, favorites } from "@/db/schema/albums";
import type { AppRouteHandler } from "@/lib/types";
import { useImageUrlCache } from "@/lib/image-cache";
import { eq, and, desc, count } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { 
  GetAlbumByTokenRoute, 
  GetFavoritesRoute, 
  CreateFavoriteRoute, 
  DeleteFavoriteRoute 
} from "./public.routes";

export const getAlbumByToken: AppRouteHandler<GetAlbumByTokenRoute> = async (c) => {
  try {
    console.log("=== getAlbumByToken handler called ===");
    const { db } = createDb(c.env);
    const { token } = c.req.valid("param");
    const { page = 1, limit = 20 } = c.req.valid("query");
    
    console.log("Looking for album with share token:", token);
    console.log("DB instance created:", !!db);
    console.log("Pagination: page =", page, "limit =", limit);

    // First, let's see all albums to debug
    const allAlbums = await db.select().from(albums).limit(5);
    console.log("First 5 albums:", allAlbums.map(a => ({ id: a.id, shareLinkToken: a.shareLinkToken })));

    // Get album by share token
    const [album] = await db
      .select({
        id: albums.id,
        title: albums.title,
        eventDate: albums.eventDate,
        totalImages: albums.totalImages,
        shareLinkToken: albums.shareLinkToken,
      })
      .from(albums)
      .where(eq(albums.shareLinkToken, token));
    
    console.log("Found album:", album);

    if (!album) {
      console.log("Album not found, returning 404");
      return c.json(
        {
          success: false,
          message: "Album not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(album.totalImages / limit);

    // Get total count for pagination
    const [imageCountResult] = await db
      .select({ count: count() })
      .from(images)
      .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')));

    const totalImages = imageCountResult.count;

    // Get paginated images for the album
    const albumImages = await db
      .select({
        id: images.id,
        b2FileName: images.b2FileName,
        originalFilename: images.originalFilename,
        width: images.width,
        height: images.height,
        createdAt: images.createdAt,
      })
      .from(images)
      .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')))
      .orderBy(desc(images.uploadOrder))
      .limit(limit)
      .offset(offset);

    // Initialize image URL cache
    const { generateImageUrl, generateThumbnailUrl, clearExpired } = useImageUrlCache();

    // Occasionally clean up expired cache entries (1 in 10 requests)
    if (Math.random() < 0.1) {
      clearExpired();
    }

    // Generate view URLs for images (exclude internal fields)
    const imagesWithUrls = await Promise.all(
      albumImages.map(async (img) => ({
        id: img.id,
        originalFilename: img.originalFilename,
        width: img.width,
        height: img.height,
        createdAt: img.createdAt,
        url: await generateImageUrl(img.b2FileName, c.env),
        thumbnailUrl: img.b2FileName ? await generateThumbnailUrl(img.b2FileName, c.env) : null,
      }))
    );

    const pagination = {
      currentPage: page,
      totalPages,
      totalImages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return c.json(
      {
        success: true,
        message: "Album retrieved successfully",
        data: {
          album,
          images: imagesWithUrls,
          pagination,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving album",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getFavorites: AppRouteHandler<GetFavoritesRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { token } = c.req.valid("param");
    const { clientName } = c.req.valid("query");

    // Verify album exists
    const [album] = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.shareLinkToken, token));

    if (!album) {
      return c.json(
        {
          success: false,
          message: "Album not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Build query conditions
    const conditions = [eq(favorites.albumId, album.id)];
    if (clientName) {
      conditions.push(eq(favorites.clientName, clientName));
    }

    // Get favorites
    const albumFavorites = await db
      .select()
      .from(favorites)
      .where(and(...conditions))
      .orderBy(desc(favorites.createdAt));

    return c.json(
      {
        success: true,
        message: "Favorites retrieved successfully",
        data: albumFavorites,
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

export const createFavorite: AppRouteHandler<CreateFavoriteRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { token } = c.req.valid("param");
    const { imageId, clientName, notes } = c.req.valid("json");

    // Verify album exists
    const [album] = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.shareLinkToken, token));

    if (!album) {
      return c.json(
        {
          success: false,
          message: "Album not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Verify image exists in this album
    const [image] = await db
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.id, imageId), eq(images.albumId, album.id)));

    if (!image) {
      return c.json(
        {
          success: false,
          message: "Image not found in this album",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Check if favorite already exists
    const [existingFavorite] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.albumId, album.id),
          eq(favorites.imageId, imageId),
          eq(favorites.clientName, clientName)
        )
      );

    if (existingFavorite) {
      return c.json(
        {
          success: false,
          message: "Favorite already exists for this client",
        },
        HttpStatusCodes.CONFLICT
      );
    }

    // Create favorite
    const [newFavorite] = await db
      .insert(favorites)
      .values({
        albumId: album.id,
        imageId,
        clientName,
        notes,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Favorite created successfully",
        data: newFavorite,
      },
      HttpStatusCodes.CREATED
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem creating favorite",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const deleteFavorite: AppRouteHandler<DeleteFavoriteRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { token, favoriteId } = c.req.valid("param");

    // Verify album exists
    const [album] = await db
      .select({ id: albums.id })
      .from(albums)
      .where(eq(albums.shareLinkToken, token));

    if (!album) {
      return c.json(
        {
          success: false,
          message: "Album not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Delete favorite (only if it belongs to this album)
    const result = await db
      .delete(favorites)
      .where(and(eq(favorites.id, parseInt(favoriteId)), eq(favorites.albumId, album.id)))
      .returning();

    if (result.length === 0) {
      return c.json(
        {
          success: false,
          message: "Favorite not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(
      {
        success: true,
        message: "Favorite deleted successfully",
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem deleting favorite",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};