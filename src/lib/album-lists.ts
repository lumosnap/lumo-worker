import { and, asc, eq } from "drizzle-orm";

import { listPicks, listSubmissions, selectionLists } from "@/db/d1-schema/albums";
import type { AppBindings } from "@/lib/types";

type Db = AppBindings["Variables"]["db"];
export type SetLimit = { setId: string; max: number };

const parseSetLimits = (raw: string | null): SetLimit[] | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as SetLimit[]) : null;
  } catch {
    return null;
  }
};

/** An album's selection lists ordered by position. */
export async function loadAlbumLists(db: Db, albumId: string) {
  const rows = await db
    .select({
      id: selectionLists.id,
      name: selectionLists.name,
      position: selectionLists.position,
      maxPicks: selectionLists.maxPicks,
      deadline: selectionLists.deadline,
      setLimits: selectionLists.setLimits,
    })
    .from(selectionLists)
    .where(eq(selectionLists.albumId, albumId))
    .orderBy(asc(selectionLists.position));
  return rows.map(l => ({ ...l, setLimits: parseSetLimits(l.setLimits) }));
}

/**
 * Picks and submissions of an album's lists, keyed by list id then client name.
 * Pass clientName to load only that client.
 */
export async function loadListActivity(db: Db, albumId: string, clientName?: string) {
  const [picks, submissions] = await Promise.all([
    db.select({ listId: listPicks.listId, clientName: listPicks.clientName, imageId: listPicks.imageId })
      .from(listPicks)
      .innerJoin(selectionLists, eq(listPicks.listId, selectionLists.id))
      .where(and(eq(selectionLists.albumId, albumId), clientName === undefined ? undefined : eq(listPicks.clientName, clientName)))
      .orderBy(asc(listPicks.imageId)),
    db.select({ listId: listSubmissions.listId, clientName: listSubmissions.clientName, submittedAt: listSubmissions.submittedAt })
      .from(listSubmissions)
      .innerJoin(selectionLists, eq(listSubmissions.listId, selectionLists.id))
      .where(and(eq(selectionLists.albumId, albumId), clientName === undefined ? undefined : eq(listSubmissions.clientName, clientName))),
  ]);

  const byList = new Map<string, Map<string, { imageIds: number[]; submittedAt: number | null }>>();
  const entry = (listId: string, name: string) => {
    let clients = byList.get(listId);
    if (!clients) byList.set(listId, (clients = new Map()));
    let e = clients.get(name);
    if (!e) clients.set(name, (e = { imageIds: [], submittedAt: null }));
    return e;
  };
  for (const p of picks) entry(p.listId, p.clientName).imageIds.push(p.imageId);
  for (const s of submissions) entry(s.listId, s.clientName).submittedAt = s.submittedAt;
  return byList;
}
