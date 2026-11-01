import { asc, eq } from "drizzle-orm";

import { albumSets, setImages } from "@/db/d1-schema/albums";
import type { AppBindings } from "@/lib/types";

/** An album's sets ordered by position, each with its image ids in set order. Two queries, run in parallel. */
export async function loadAlbumSets(db: AppBindings["Variables"]["db"], albumId: string) {
  const [sets, members] = await Promise.all([
    db.select({ id: albumSets.id, name: albumSets.name, position: albumSets.position, coverImageId: albumSets.coverImageId })
      .from(albumSets)
      .where(eq(albumSets.albumId, albumId))
      .orderBy(asc(albumSets.position)),
    db.select({ setId: setImages.setId, imageId: setImages.imageId })
      .from(setImages)
      .where(eq(setImages.albumId, albumId))
      .orderBy(asc(setImages.setId), asc(setImages.position)),
  ]);

  const idsBySet = new Map<string, number[]>();
  for (const { setId, imageId } of members) {
    const ids = idsBySet.get(setId);
    if (ids) ids.push(imageId);
    else idsBySet.set(setId, [imageId]);
  }
  return sets.map(s => ({ ...s, imageIds: idsBySet.get(s.id) ?? [] }));
}
