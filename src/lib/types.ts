import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { InferSelectModel } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";

import type { Environment } from "@/env";
import type { user, session } from "@/db/schema/auth";
import type * as schema from "@/db/schema";

// Derive base types from Drizzle schema (compatible with Better Auth)
type UserBase = InferSelectModel<typeof user>;
type SessionBase = InferSelectModel<typeof session>;

// Make optional fields accept undefined (Better Auth compatibility)
export type User = {
  [K in keyof UserBase]: null extends UserBase[K] ? UserBase[K] | undefined : UserBase[K];
};
export type Session = {
  [K in keyof SessionBase]: null extends SessionBase[K] ? SessionBase[K] | undefined : SessionBase[K];
};

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    user: User | null;
    session: Session | null;
    db: PostgresJsDatabase<typeof schema>;
    dbClient: Sql;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
