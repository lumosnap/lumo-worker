import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { parseEnv } from "@/env";
import { pinoLogger } from "@/middlewares/pino-logger";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { AppBindings } from "./types";
import { cors } from 'hono/cors'

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();

  // Parse environment variables
  app.use((c, next) => {
    // eslint-disable-next-line node/no-process-env
    c.env = parseEnv(Object.assign(c.env || {}, process.env));
    return next();
  });

  // Middleware
  app.use(serveEmojiFavicon("😎"));
  app.use(pinoLogger());

  // Remove the /doc middleware completely ❌

  // Scalar API reference protection - simplified ✅
  app.use('/reference', async (c, next) => {
    const secretKey = c.req.query('key');
    if (secretKey === c.env.SCALAR_OPENAPI_CLIENT_KEY) {
      return next();
    }
    return c.json({
      success: false,
      message: 'Unauthorized',
    }, HttpStatusCodes.UNAUTHORIZED)
  })

  // CORS for all routes
  app.use('*', cors({
    origin: 'http://localhost:3000',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Set-Cookie'],
    maxAge: 2592000
  }))

  // Error handlers
  app.notFound(notFound);
  app.onError(onError);

  return app;
}
