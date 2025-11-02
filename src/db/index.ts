import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { Environment } from "@/env";

import * as schema from "./schema";

export function createDb(env: Environment) {
  const client = postgres(env.DATABASE_URL);
  const db = drizzle(client, { schema });
  return { db, client };
}
