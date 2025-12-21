import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { InferSelectModel } from "drizzle-orm";

import type { Environment } from "@/env";
import type { user, session } from "@/db/schema/auth";

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
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
