import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

import type { Environment } from "@/env";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    logger: PinoLogger;
    secret: any;
    user: any; // Better Auth user type
    session: any; // Better Auth session type
  };
};

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
