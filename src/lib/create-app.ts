import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { parseEnv } from "@/env";
import { pinoLogger } from "@/middlewares/pino-logger";
import { authMiddleware } from "@/middlewares/auth";
import { createDb } from "@/db";
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

  // Parse environment variables (preserve D1 binding from Cloudflare runtime)
  app.use((c, next) => {
    // eslint-disable-next-line node/no-process-env
    const parsedEnv = parseEnv(Object.assign(c.env || {}, process.env));
    // Preserve D1 binding from Cloudflare runtime
    c.env = { ...parsedEnv, lumo_db: (c.env as any).lumo_db } as typeof c.env;
    return next();
  });

  // Initialize database connection once per request
  app.use(async (c, next) => {
    const { db } = createDb(c.env);
    c.set('db', db);
    return next();
  });

  // Middleware
  app.use(serveEmojiFavicon("😎"));
  app.use(pinoLogger());

  // CORS for all routes (placed before auth middleware)
  app.use('*', cors({
    origin: (origin, c) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        c.env.WEB_DOMAIN,
        c.env.ONBOARDING_URL,
        c.env.ADMIN_DOMAIN
      ].filter(Boolean);

      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return null;

      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'User-Agent', 'Accept', 'Accept-Encoding', 'Accept-Language', 'Referer', 'Origin'],
    exposeHeaders: ['Set-Cookie'],
    maxAge: 2592000
  }))

  // Better Auth middleware for session management
  app.use("*", authMiddleware);

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

  // Error handlers
  app.notFound(notFound);
  app.onError(onError);

  return app;
}
