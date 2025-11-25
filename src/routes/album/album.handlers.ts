import { createDb } from "@/db";
import { albums } from "@/db/schema/albums";
import type { AppRouteHandler } from "@/lib/types";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateAlbumRoute, GenerateUploadUrlRoute, ListAlbumsRoute } from "./album.routes";
import { useBackBlaze } from "@/lib/backblaze";

// Get all albums
export const listAlbums: AppRouteHandler<ListAlbumsRoute> = async (c) => {
  try {

    const { db } = createDb(c.env);

    const results = await db.select().from(albums);

    return c.json(
      {
        success: true,
        message: "Albums fetched successfully",
        data: results,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: "Problem fetching albums",
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
