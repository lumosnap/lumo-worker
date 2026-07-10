import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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
    c.env = { ...parsedEnv, lumo_db: c.env.lumo_db } as typeof c.env;
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
      // Parse BRANCH_URLS from environment (supports JSON array or comma-separated)
      const branchUrls: string[] = (() => {
        if (!c.env.BRANCH_URLS) return [];
        try {
          const parsed = JSON.parse(c.env.BRANCH_URLS);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          // Fallback to comma-separated
          return c.env.BRANCH_URLS.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      })();

      // Existing allowed origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        c.env.WEB_DOMAIN,
        c.env.ONBOARDING_URL,
        c.env.ADMIN_DOMAIN
      ].filter(Boolean);

      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return null;

      // Check if origin is in allowed origins list
      if (allowedOrigins.includes(origin)) return origin;

      // Check if origin's domain matches any branch URL or its subdomains
      try {
        const originHostname = new URL(origin).hostname;
        if (branchUrls.some(branchUrl => 
          originHostname === branchUrl || originHostname.endsWith('.' + branchUrl)
        )) {
          return origin;
        }
      } catch {
        // Invalid URL format, skip branch URL check
      }

      return null;
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

  // Central error boundary. Route handlers let unexpected errors propagate here
  // instead of each re-implementing a generic 500. The response keeps the shared
  // `errorResponseSchema` shape ({ success, message }) that every route declares.
  app.onError((err, c) => {
    c.get("logger")?.error({ err }, "Unhandled request error");

    const status: ContentfulStatusCode
      = err instanceof HTTPException
        ? (err.status as ContentfulStatusCode)
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

    return c.json(
      {
        success: false,
        message: err.message || "Internal server error",
      },
      status,
    );
  });

  return app;
}
