import { drizzle } from "drizzle-orm/d1";

import * as schema from "./d1-schema";

// D1Database type is globally available from @cloudflare/workers-types
export function createDb(env: { lumo_db: D1Database }) {
  const db = drizzle(env.lumo_db, { schema });
  return { db };
}
