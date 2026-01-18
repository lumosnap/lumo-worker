import { albums, images, favorites } from "@/db/schema/albums";
import { profiles } from "@/db/schema/profiles";
import { user } from "@/db/schema/auth";
import { bookings } from "@/db/schema/bookings";
import type { AppRouteHandler } from "@/lib/types";
import { useImageUrlCache } from "@/lib/image-cache";
import { eq, and, desc, asc, count, isNotNull, ne, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type {
  GetAlbumByTokenRoute,
  GetFavoriteImagesRoute,
  CreateFavoriteRoute,
  DeleteFavoriteRoute,
  UpdateNotesRoute,
  GetPhotographerDetailsRoute,
  CreateBookingRoute
} from "./public.routes";

export const getAlbumByToken: AppRouteHandler<GetAlbumByTokenRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { token } = c.req.valid("param");
    const { clientName, favorites: favoritesParam, page = 1, limit = 80 } = c.req.valid("query");

    const favoriteOnly = favoritesParam === 'true' || favoritesParam === '1';

    // Get album by share token
    const [album] = await db
      .select({
        id: albums.id,
        title: albums.title,
        eventDate: albums.eventDate,
        totalImages: albums.totalImages,
        shareLinkToken: albums.shareLinkToken,
        userId: albums.userId,
        isSecondaryStorage: albums.isSecondaryStorage,
      })
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

    // Get owner profile info (businessName or username)
    const [profile] = await db
      .select({
        businessName: profiles.businessName,
      })
      .from(profiles)
      .where(and(
        eq(profiles.userId, album.userId!),
        isNotNull(profiles.userId)
      ));

    const [owner] = await db
      .select({
        name: user.name,
      })
      .from(user)
      .where(and(
        eq(user.id, album.userId!),
        isNotNull(user.id)
      ));

    const ownerName = profile?.businessName || owner?.name || null;

    // Get all favorites for this album (for filtering and building response)
    const albumFavorites = await db
      .select()
      .from(favorites)
      .where(eq(favorites.albumId, album.id));

    // Get image IDs that have favorites (for favorite filter) and count
    const favoritedImageIds = new Set(
      albumFavorites
        .map((fav) => fav.imageId)
        .filter((id): id is number => id !== null)
    );

    // Count of photos with at least 1 favorite
    const favoritedPhotosCount = favoritedImageIds.size;

    // If favorite filter is enabled, we need to handle pagination differently
    let totalImages = 0;
    let paginatedImages: Array<{
      id: number;
      b2FileName: string;
      originalFilename: string;
      width: number;
      height: number;
      createdAt: Date;
      thumbnailB2FileId: string | null;
      thumbnailB2FileName: string | null;
    }>;

    if (favoriteOnly) {
      // For favorite filter, get all complete images first, then filter
      const allImages = await db
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
        .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')))
        .orderBy(asc(images.uploadOrder));

      // Filter to only favorited images (images that have at least one favorite from anyone)
      const filteredImages = allImages.filter((img) => favoritedImageIds.has(img.id));
      totalImages = filteredImages.length;

      // Apply pagination after filtering
      const offset = (page - 1) * limit;
      paginatedImages = filteredImages.slice(offset, offset + limit);
    } else {
      // Normal pagination
      const offset = (page - 1) * limit;
      const [imageCountResult] = await db
        .select({ count: count() })
        .from(images)
        .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')));

      totalImages = imageCountResult.count;

      paginatedImages = await db
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
        .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')))
        .orderBy(asc(images.uploadOrder))
        .limit(limit)
        .offset(offset);
    }

    const totalPages = Math.ceil(totalImages / limit);

    // Initialize image URL cache
    const { generateImageUrl, generateThumbnailUrl, clearExpired } = useImageUrlCache();

    // Occasionally clean up expired cache entries (1 in 10 requests)
    if (Math.random() < 0.1) {
      clearExpired();
    }

    // Build a map of imageId to favorites
    const favoritesByImage = new Map<number, typeof albumFavorites>();
    for (const fav of albumFavorites) {
      if (fav.imageId !== null) {
        if (!favoritesByImage.has(fav.imageId)) {
          favoritesByImage.set(fav.imageId, []);
        }
        favoritesByImage.get(fav.imageId)!.push(fav);
      }
    }

    // Generate view URLs for images with favorite data
    const imagesWithFavoriteData = await Promise.all(
      paginatedImages.map(async (img: any) => {
        const imageFavorites = favoritesByImage.get(img.id) || [];

        // Build comments array (all favorites for this image)
        const comments = imageFavorites.map((fav) => ({
          clientName: fav.clientName,
          notes: fav.notes,
          createdAt: fav.createdAt,
        }));

        // Count of favorites with non-empty notes
        const notesCount = imageFavorites.filter((fav) => fav.notes && fav.notes.trim() !== '').length;

        // Find user's favorite for this image
        const userFavorite = clientName
          ? imageFavorites.find((fav) => fav.clientName === clientName)
          : undefined;

        return {
          id: img.id,
          originalFilename: img.originalFilename,
          width: img.width,
          height: img.height,
          createdAt: img.createdAt,
          url: await generateImageUrl(img.b2FileName, c.env, album.isSecondaryStorage!),
          thumbnailUrl: img.thumbnailB2FileName ? await generateThumbnailUrl(img.thumbnailB2FileName, c.env, album.isSecondaryStorage!) : null,
          favoriteCount: imageFavorites.length,
          notesCount,
          comments,
          userFavorite: userFavorite
            ? {
              id: userFavorite.id,
              notes: userFavorite.notes,
              createdAt: userFavorite.createdAt,
            }
            : null,
        };
      })
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
          album: {
            id: album.id,
            title: album.title,
            eventDate: album.eventDate,
            totalImages: album.totalImages,
            shareLinkToken: album.shareLinkToken,
            favoritedPhotosCount,
            ownerName,
          },
          images: imagesWithFavoriteData,
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

export const getFavoriteImages: AppRouteHandler<GetFavoriteImagesRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { token } = c.req.valid("param");
    const { clientName } = c.req.valid("query");

    // Verify album exists
    const [album] = await db
      .select({ id: albums.id, isSecondaryStorage: albums.isSecondaryStorage })
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

    // Get favorites for this specific client
    const clientFavorites = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.albumId, album.id), eq(favorites.clientName, clientName)))
      .orderBy(desc(favorites.createdAt));

    // If no favorites, return empty array
    if (clientFavorites.length === 0) {
      return c.json(
        {
          success: true,
          message: "Favorite images retrieved successfully",
          data: [],
        },
        HttpStatusCodes.OK
      );
    }

    // Get image IDs
    const imageIds = clientFavorites.map((fav) => fav.imageId!).filter(Boolean);

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
      .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')));

    // Filter images to only those favorited by the client
    const filteredImages = favoritedImages.filter((img) => imageIds.includes(img.id));

    // Get all favorites for these images (for comments)
    const allFavoritesForImages = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.albumId, album.id),
          clientFavorites[0].imageId !== null ? eq(favorites.imageId, clientFavorites[0].imageId!) : sql`TRUE`
        )
      );

    // Build a map of imageId to favorites
    const favoritesByImage = new Map<number, typeof clientFavorites>();
    for (const fav of clientFavorites) {
      if (fav.imageId !== null) {
        // Get all favorites for each image
        const imageFavorites = await db
          .select()
          .from(favorites)
          .where(and(eq(favorites.albumId, album.id), eq(favorites.imageId, fav.imageId!)));
        favoritesByImage.set(fav.imageId, imageFavorites);
      }
    }

    // Initialize image URL cache
    const { generateImageUrl, generateThumbnailUrl } = useImageUrlCache();

    // Generate images with favorite data
    const imagesWithFavoriteData = await Promise.all(
      filteredImages.map(async (img) => {
        const imageFavorites = favoritesByImage.get(img.id) || [];

        // Build comments array
        const comments = imageFavorites.map((fav) => ({
          clientName: fav.clientName,
          notes: fav.notes,
          createdAt: fav.createdAt,
        }));

        // Count of favorites with non-empty notes
        const notesCount = imageFavorites.filter((fav) => fav.notes && fav.notes.trim() !== '').length;

        // Find user's favorite
        const userFavorite = imageFavorites.find((fav) => fav.clientName === clientName);

        return {
          id: img.id,
          originalFilename: img.originalFilename,
          width: img.width,
          height: img.height,
          createdAt: img.createdAt,
          url: await generateImageUrl(img.b2FileName, c.env, album.isSecondaryStorage!),
          thumbnailUrl: img.thumbnailB2FileName ? await generateThumbnailUrl(img.thumbnailB2FileName, c.env, album.isSecondaryStorage!) : null,
          favoriteCount: imageFavorites.length,
          notesCount,
          comments,
          userFavorite: userFavorite
            ? {
              id: userFavorite.id,
              notes: userFavorite.notes,
              createdAt: userFavorite.createdAt,
            }
            : null,
        };
      })
    );

    return c.json(
      {
        success: true,
        message: "Favorite images retrieved successfully",
        data: imagesWithFavoriteData,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving favorite images",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const createFavorite: AppRouteHandler<CreateFavoriteRoute> = async (c) => {
  try {
    const db = c.get('db');
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
    const db = c.get('db');
    const { token, favoriteId } = c.req.valid("param");
    const { clientName } = c.req.valid("json");

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

    // Get the favorite to verify clientName matches
    const [existingFavorite] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.id, parseInt(favoriteId)), eq(favorites.albumId, album.id)));

    if (!existingFavorite) {
      return c.json(
        {
          success: false,
          message: "Favorite not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Verify clientName matches (only the creator can delete)
    if (existingFavorite.clientName !== clientName) {
      return c.json(
        {
          success: false,
          message: "You are not authorized to delete this favorite",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Delete favorite
    await db
      .delete(favorites)
      .where(eq(favorites.id, parseInt(favoriteId)));

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

export const updateNotes: AppRouteHandler<UpdateNotesRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { token, favoriteId } = c.req.valid("param");
    const { clientName, notes } = c.req.valid("json");

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

    // Get the favorite to verify clientName matches
    const [existingFavorite] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.id, parseInt(favoriteId)), eq(favorites.albumId, album.id)));

    if (!existingFavorite) {
      return c.json(
        {
          success: false,
          message: "Favorite not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Verify clientName matches (only the creator can update)
    if (existingFavorite.clientName !== clientName) {
      return c.json(
        {
          success: false,
          message: "You are not authorized to update this favorite",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Update notes
    const result = await db
      .update(favorites)
      .set({ notes })
      .where(eq(favorites.id, parseInt(favoriteId)))
      .returning();

    return c.json(
      {
        success: true,
        message: "Notes updated successfully",
        data: result[0],
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating notes",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getPhotographerDetails: AppRouteHandler<GetPhotographerDetailsRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { photographerId } = c.req.valid("param");

    // Verify photographer (user) exists
    const [photographer] = await db
      .select({
        id: user.id,
        name: user.name,
      })
      .from(user)
      .where(eq(user.id, photographerId));

    if (!photographer) {
      return c.json(
        {
          success: false,
          message: "Photographer not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Get profile details
    const [profile] = await db
      .select({
        businessName: profiles.businessName,
        phone: profiles.phone,
      })
      .from(profiles)
      .where(eq(profiles.userId, photographerId));

    return c.json(
      {
        success: true,
        message: "Photographer details retrieved successfully",
        data: {
          id: photographer.id,
          businessName: profile?.businessName ?? photographer.name,
          phone: profile?.phone ?? null,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving photographer details",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const createBooking: AppRouteHandler<CreateBookingRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { photographerId } = c.req.valid("param");
    const body = c.req.valid("json");

    // Verify photographer (user) exists
    const [photographer] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, photographerId));

    if (!photographer) {
      return c.json(
        {
          success: false,
          message: "Photographer not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Create booking
    const [newBooking] = await db
      .insert(bookings)
      .values({
        photographerId,
        eventType: body.eventType,
        name: body.name,
        phone: body.phone,
        eventDate: body.eventDate,
        location: body.location,
        details: body.details ?? null,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Booking created successfully",
        data: newBooking,
      },
      HttpStatusCodes.CREATED
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem creating booking",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
