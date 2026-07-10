import type { Context } from "hono";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { albums } from "@/db/d1-schema/albums";
import type { AppBindings } from "@/lib/types";

type Album = typeof albums.$inferSelect;

/**
 * Fetch an album by id and verify the given user owns it.
 * Returns the album, or a ready-to-return error response (404 / 403)
 * matching the shared { success, message } envelope.
 */
export async function getOwnedAlbum(
  c: Context<AppBindings>,
  albumId: string,
  userId: string,
) {
  const db = c.get("db");
  const [album] = await db.select().from(albums).where(eq(albums.id, albumId));

  if (!album) {
    return {
      album: null,
      response: c.json(
        { success: false, message: "Album not found" },
        HttpStatusCodes.NOT_FOUND,
      ),
    };
  }

  if (album.userId !== userId) {
    return {
      album: null,
      response: c.json(
        { success: false, message: "Forbidden - you don't own this album" },
        HttpStatusCodes.FORBIDDEN,
      ),
    };
  }

  return { album, response: undefined };
}
