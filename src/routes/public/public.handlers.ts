import { albums, images, favorites, selectionLists, listPicks, listSubmissions, setImages } from "@/db/d1-schema/albums";
import { profiles } from "@/db/d1-schema/profiles";
import { user } from "@/db/d1-schema/auth";
import { bookings } from "@/db/d1-schema/bookings";
import type { AppRouteHandler, AppBindings } from "@/lib/types";
import { useImageUrlCache } from "@/lib/image-cache";
import { loadAlbumSets } from "@/lib/album-sets";
import { loadAlbumPeople } from "@/lib/album-people";
import { loadAlbumLists, loadListActivity } from "@/lib/album-lists";
import { eq, and, desc, asc, count, isNotNull, ne, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type {
  GetAlbumByTokenRoute,
  GetFavoriteImagesRoute,
  GetShareManifestRoute,
  GetShareFeedbackRoute,
  CreateFavoriteRoute,
  DeleteFavoriteRoute,
  UpdateNotesRoute,
  GetPhotographerDetailsRoute,
  CreateBookingRoute,
  BatchFavoritesRoute,
  PutListPicksRoute,
  SubmitListRoute
} from "./public.routes";

// D1 caps bound parameters at 100 per statement.
const chunk = <T,>(rows: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

// FNV-1a, for folding small JSON into an ETag.
const hash32 = (str: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

// JSON array bound as one parameter, so id lists of any length stay under D1's 100-param limit.
const jsonIds = (ids: Array<string | number>) => sql`(select value from json_each(${JSON.stringify(ids)}))`;

const isBrowseV2 = (features: string | null): boolean => {
  if (!features) return false;
  try {
    return JSON.parse(features)?.browseV2 === true;
  } catch {
    return false;
  }
};

// Owner display name for share pages: businessName, else user name
const getOwnerName = async (db: AppBindings["Variables"]["db"], userId: string): Promise<string | null> => {
  const [profile] = await db
    .select({
      businessName: profiles.businessName,
    })
    .from(profiles)
    .where(and(
      eq(profiles.userId, userId),
      isNotNull(profiles.userId)
    ));

  const [owner] = await db
    .select({
      name: user.name,
    })
    .from(user)
    .where(and(
      eq(user.id, userId),
      isNotNull(user.id)
    ));

  return profile?.businessName || owner?.name || null;
};

export const getAlbumByToken: AppRouteHandler<GetAlbumByTokenRoute> = async (c) => {
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
      features: albums.features,
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

  const ownerName = await getOwnerName(db, album.userId!);

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
    paginatedImages.map(async (img) => {
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
          browseV2: isBrowseV2(album.features),
        },
        images: imagesWithFavoriteData,
        pagination,
      },
    },
    HttpStatusCodes.OK
  );
};

export const getShareManifest: AppRouteHandler<GetShareManifestRoute> = async (c) => {
  const db = c.get('db');
  const { token } = c.req.valid("param");

  // Same access rule as getAlbumByToken: share token lookup only
  const [album] = await db
    .select({
      id: albums.id,
      title: albums.title,
      eventDate: albums.eventDate,
      totalImages: albums.totalImages,
      userId: albums.userId,
      isSecondaryStorage: albums.isSecondaryStorage,
      features: albums.features,
      updatedAt: albums.updatedAt,
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

  const [rows, ownerName, sets, people, lists] = await Promise.all([db
    .select({
      id: images.id,
      f: images.b2FileName,
      t: images.thumbnailB2FileName,
      w: images.width,
      h: images.height,
      o: images.uploadOrder,
      c: images.capturedAt,
      b: images.burstId,
      bc: images.isBurstCover,
      m: images.momentId,
      th: images.thumbhash,
      g: images.tags,
    })
    .from(images)
    .where(and(eq(images.albumId, album.id), eq(images.uploadStatus, 'complete')))
    .orderBy(asc(images.uploadOrder)), getOwnerName(db, album.userId!), loadAlbumSets(db, album.id), loadAlbumPeople(db, album.id), loadAlbumLists(db, album.id)]);

  // Version signal: album.updatedAt is bumped on upload/patch/delete; count + max id cover same-second changes.
  // ponytail: updatedAt has 1s resolution, so two patches inside one second can share an ETag until max-age expires.
  // ponytail: ownerName is not in the ETag; a profile rename shows on the next album change. Hash it in if that matters.
  const maxId = rows.reduce((max, img) => Math.max(max, img.id), 0);
  const browseV2 = isBrowseV2(album.features);
  const manifestLists = lists.map((l) => ({ id: l.id, name: l.name, maxPicks: l.maxPicks, deadline: l.deadline, setLimits: l.setLimits }));
  const etag = `W/"${album.updatedAt.getTime()}-${rows.length}-${maxId}-${browseV2 ? 1 : 0}-${hash32(JSON.stringify(manifestLists))}"`;

  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, HttpStatusCodes.NOT_MODIFIED);
  }

  return c.json(
    {
      v: 1 as const,
      album: {
        id: album.id,
        title: album.title,
        eventDate: album.eventDate,
        totalImages: album.totalImages,
        ownerName,
        browseV2,
      },
      base: album.isSecondaryStorage ? c.env.STORAGE2_PUBLIC_URL_BASE : c.env.STORAGE_PUBLIC_URL_BASE,
      images: rows.map((img) => ({ ...img, bc: img.bc ?? false, g: img.g ? img.g.split(' ') : null })),
      sets: sets.map((s) => ({ id: s.id, name: s.name, cover: s.coverImageId, ids: s.imageIds })),
      people: people.map((p) => ({ id: p.id, name: p.name, cover: p.coverImageId, box: p.box, ids: p.imageIds })),
      lists: manifestLists,
    },
    HttpStatusCodes.OK
  );
};

export const getShareFeedback: AppRouteHandler<GetShareFeedbackRoute> = async (c) => {
  const db = c.get('db');
  const { token } = c.req.valid("param");
  const { clientName } = c.req.valid("query");

  c.header('Cache-Control', 'private, no-store');

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

  const [albumFavorites, albumLists, activity] = await Promise.all([db
    .select({
      imageId: favorites.imageId,
      clientName: favorites.clientName,
      notes: favorites.notes,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .where(eq(favorites.albumId, album.id)),
    loadAlbumLists(db, album.id),
    clientName ? loadListActivity(db, album.id, clientName) : Promise.resolve(new Map()),
  ]);
  const lists: Record<string, { imageIds: number[]; submittedAt: number | null }> = {};
  for (const l of albumLists) {
    lists[l.id] = activity.get(l.id)?.get(clientName!) ?? { imageIds: [], submittedAt: null };
  }

  // Same comment semantics as getAlbumByToken: every favorite on an image is a comment entry
  const favoritedByClient: number[] = [];
  const counts: Record<string, number> = {};
  const comments: Record<string, Array<{ clientName: string; notes: string | null; createdAt: Date }>> = {};
  for (const fav of albumFavorites) {
    if (fav.imageId === null) continue;
    if (clientName && fav.clientName === clientName) favoritedByClient.push(fav.imageId);
    counts[fav.imageId] = (counts[fav.imageId] ?? 0) + 1;
    (comments[fav.imageId] ??= []).push({
      clientName: fav.clientName,
      notes: fav.notes,
      createdAt: fav.createdAt,
    });
  }

  return c.json(
    {
      favorites: favoritedByClient,
      counts,
      comments,
      lists,
    },
    HttpStatusCodes.OK
  );
};

export const getFavoriteImages: AppRouteHandler<GetFavoriteImagesRoute> = async (c) => {
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
        clientFavorites[0].imageId !== null ? eq(favorites.imageId, clientFavorites[0].imageId!) : sql`1`
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
};

export const createFavorite: AppRouteHandler<CreateFavoriteRoute> = async (c) => {
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
};

export const deleteFavorite: AppRouteHandler<DeleteFavoriteRoute> = async (c) => {
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
};

export const updateNotes: AppRouteHandler<UpdateNotesRoute> = async (c) => {
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
};

export const batchFavorites: AppRouteHandler<BatchFavoritesRoute> = async (c) => {
  const db = c.get('db');
  const { token } = c.req.valid("param");
  const { clientName, changes } = c.req.valid("json");

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

  const results: Array<{
    imageId: number;
    success: boolean;
    message?: string;
  }> = [];

  // Process changes sequentially to avoid race conditions and simplify logic
  // Using a transaction would be ideal but D1 transactions have limitations
  for (const change of changes) {
    try {
      // Verify image exists in this album
      const [image] = await db
        .select({ id: images.id })
        .from(images)
        .where(and(eq(images.id, change.imageId), eq(images.albumId, album.id)));

      if (!image) {
        results.push({
          imageId: change.imageId,
          success: false,
          message: "Image not found in this album",
        });
        continue;
      }

      if (change.action === 'unfavorite') {
        // Delete favorite
        await db
          .delete(favorites)
          .where(
            and(
              eq(favorites.albumId, album.id),
              eq(favorites.imageId, change.imageId),
              eq(favorites.clientName, clientName)
            )
          );

        results.push({
          imageId: change.imageId,
          success: true,
        });

      } else if (change.action === 'favorite' || change.action === 'comment') {
        // Check if favorite already exists
        const [existingFavorite] = await db
          .select()
          .from(favorites)
          .where(
            and(
              eq(favorites.albumId, album.id),
              eq(favorites.imageId, change.imageId),
              eq(favorites.clientName, clientName)
            )
          );

        if (existingFavorite) {
          // Update notes if provided or if it's a comment action
          if (change.notes !== undefined) {
            await db
              .update(favorites)
              .set({ notes: change.notes })
              .where(eq(favorites.id, existingFavorite.id));
          }
          results.push({
            imageId: change.imageId,
            success: true,
            message: "Updated existing favorite",
          });
        } else {
          // Create new favorite
          await db
            .insert(favorites)
            .values({
              albumId: album.id,
              imageId: change.imageId,
              clientName,
              notes: change.notes || null,
            });
          results.push({
            imageId: change.imageId,
            success: true,
            message: "Created new favorite",
          });
        }
      }
    } catch (err) {
      c.get("logger").error({ error: err, imageId: change.imageId }, "Error processing batch item");
      results.push({
        imageId: change.imageId,
        success: false,
        message: "Internal error processing item",
      });
    }
  }

  return c.json(
    {
      success: true,
      message: "Batch operations completed",
      results,
    },
    HttpStatusCodes.OK
  );

};

export const getPhotographerDetails: AppRouteHandler<GetPhotographerDetailsRoute> = async (c) => {
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
};

export const createBooking: AppRouteHandler<CreateBookingRoute> = async (c) => {
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
};

// Album by share token + one of its lists; null when either is missing.
const getShareList = async (db: AppBindings["Variables"]["db"], token: string, listId: string) => {
  const [row] = await db
    .select({ albumId: albums.id, maxPicks: selectionLists.maxPicks, deadline: selectionLists.deadline, setLimits: selectionLists.setLimits })
    .from(albums)
    .innerJoin(selectionLists, and(eq(selectionLists.albumId, albums.id), eq(selectionLists.id, listId)))
    .where(eq(albums.shareLinkToken, token));
  return row ?? null;
};

const notFound = { success: false, message: "Album or list not found" };

export const putListPicks: AppRouteHandler<PutListPicksRoute> = async (c) => {
  const db = c.get('db');
  const { token, listId } = c.req.valid("param");
  const { clientName, add, remove } = c.req.valid("json");

  const list = await getShareList(db, token, listId);
  if (!list) return c.json(notFound, HttpStatusCodes.NOT_FOUND);

  const [[submitted], current, validAdds] = await Promise.all([
    db.select({ at: listSubmissions.submittedAt }).from(listSubmissions)
      .where(and(eq(listSubmissions.listId, listId), eq(listSubmissions.clientName, clientName))),
    db.select({ id: listPicks.imageId }).from(listPicks)
      .where(and(eq(listPicks.listId, listId), eq(listPicks.clientName, clientName))),
    add.length
      ? db.select({ id: images.id }).from(images).where(and(eq(images.albumId, list.albumId), sql`${images.id} in ${jsonIds(add)}`))
      : Promise.resolve([]),
  ]);
  if (submitted || (list.deadline !== null && Date.now() > list.deadline)) {
    return c.json({ error: 'locked' as const }, HttpStatusCodes.LOCKED);
  }

  const before = new Set(current.map(r => r.id));
  const after = new Set(before);
  for (const id of remove) after.delete(id);
  for (const { id } of validAdds) after.add(id);

  // A limit only blocks changes that grow past it, so lowering a limit never traps a client mid-trim.
  if (list.maxPicks !== null && after.size > list.maxPicks && after.size > before.size) {
    return c.json({ error: 'limit' as const, maxPicks: list.maxPicks }, HttpStatusCodes.CONFLICT);
  }
  const setLimits: Array<{ setId: string; max: number }> = list.setLimits ? JSON.parse(list.setLimits) : [];
  if (setLimits.length) {
    const touched = [...new Set([...before, ...after])];
    const members = touched.length
      ? await db.select({ setId: setImages.setId, imageId: setImages.imageId }).from(setImages)
          .where(and(sql`${setImages.setId} in ${jsonIds(setLimits.map(l => l.setId))}`, sql`${setImages.imageId} in ${jsonIds(touched)}`))
      : [];
    for (const { setId, max } of setLimits) {
      const inSet = members.filter(m => m.setId === setId);
      const was = inSet.filter(m => before.has(m.imageId)).length;
      const now = inSet.filter(m => after.has(m.imageId)).length;
      if (now > max && now > was) {
        return c.json({ error: 'limit' as const, maxPicks: list.maxPicks, setId, max }, HttpStatusCodes.CONFLICT);
      }
    }
  }

  // ponytail: check-then-write, so two concurrent requests from one client can overshoot a limit by a batch. Fine for one person tapping.
  const removed = [...before].filter(id => !after.has(id));
  const added = [...after].filter(id => !before.has(id));
  if (removed.length || added.length) {
    const now = new Date();
    await db.batch([
      db.delete(listPicks).where(and(
        eq(listPicks.listId, listId),
        eq(listPicks.clientName, clientName),
        sql`${listPicks.imageId} in ${jsonIds(removed)}`,
      )),
      ...chunk(added.map(imageId => ({ listId, imageId, clientName, createdAt: now })), 25) // 4 params per row
        .map(rows => db.insert(listPicks).values(rows).onConflictDoNothing()),
    ]);
  }

  return c.json({ imageIds: [...after].sort((a, b) => a - b) }, HttpStatusCodes.OK);
};

export const submitList: AppRouteHandler<SubmitListRoute> = async (c) => {
  const db = c.get('db');
  const { token, listId } = c.req.valid("param");
  const { clientName } = c.req.valid("json");

  const list = await getShareList(db, token, listId);
  if (!list) return c.json(notFound, HttpStatusCodes.NOT_FOUND);

  await db.insert(listSubmissions).values({ listId, clientName, submittedAt: Date.now() }).onConflictDoNothing();
  const [row] = await db.select({ submittedAt: listSubmissions.submittedAt }).from(listSubmissions)
    .where(and(eq(listSubmissions.listId, listId), eq(listSubmissions.clientName, clientName)));

  return c.json({ submittedAt: row!.submittedAt }, HttpStatusCodes.OK);
};
