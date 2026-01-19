import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { InferSelectModel } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import type { Environment } from "@/env";
import type { user, session } from "@/db/d1-schema/auth";
import type * as schema from "@/db/d1-schema";

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
    db: DrizzleD1Database<typeof schema>;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
