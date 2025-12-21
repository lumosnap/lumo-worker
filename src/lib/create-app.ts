import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { parseEnv } from "@/env";
import { pinoLogger } from "@/middlewares/pino-logger";
import { authMiddleware } from "@/middlewares/auth";
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

  // CORS for all routes (placed before auth middleware)
  app.use('*', cors({
    origin: (origin, c) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        c.env.WEB_DOMAIN
      ].filter(Boolean);
      
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return true;
      
      return allowedOrigins.includes(origin);
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
