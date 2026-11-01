import { asc, eq } from "drizzle-orm";

import { albumPeople, imagePeople } from "@/db/d1-schema/albums";
import type { AppBindings } from "@/lib/types";

export type PersonBox = [number, number, number, number];

const parseBox = (box: string | null): PersonBox | null => {
  if (!box) return null;
  try {
    const b = JSON.parse(box);
    return Array.isArray(b) && b.length === 4 ? (b as PersonBox) : null;
  } catch {
    return null;
  }
};

/** An album's people ordered by position, each with its image ids (ascending). Two queries, run in parallel. */
export async function loadAlbumPeople(db: AppBindings["Variables"]["db"], albumId: string) {
  const [people, members] = await Promise.all([
    db.select({ id: albumPeople.id, name: albumPeople.name, position: albumPeople.position, coverImageId: albumPeople.coverImageId, box: albumPeople.box })
      .from(albumPeople)
      .where(eq(albumPeople.albumId, albumId))
      .orderBy(asc(albumPeople.position)),
    db.select({ personId: imagePeople.personId, imageId: imagePeople.imageId })
      .from(imagePeople)
      .where(eq(imagePeople.albumId, albumId))
      .orderBy(asc(imagePeople.personId), asc(imagePeople.imageId)),
  ]);

  const idsByPerson = new Map<string, number[]>();
  for (const { personId, imageId } of members) {
    const ids = idsByPerson.get(personId);
    if (ids) ids.push(imageId);
    else idsByPerson.set(personId, [imageId]);
  }
  return people.map(p => ({ ...p, box: parseBox(p.box), imageIds: idsByPerson.get(p.id) ?? [] }));
}
