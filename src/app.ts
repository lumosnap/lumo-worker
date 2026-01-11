import configureOpenAPI from "@/lib/configure-open-api";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import createApp from "@/lib/create-app";
import hello from "@/routes/hello/hello.index";
import album from "@/routes/album/album.index";
import publicRoutes from "@/routes/public/public.index";
import profile from "@/routes/profile/profile.index";
import billing from "@/routes/billing/billing.index";
import plans from "@/routes/plans/index"; // Import user plans router
import index from "@/routes/index.route";
import admin from "@/routes/admin/admin.index";
import { createAuth } from "@/lib/auth";
import * as HttpStatusCodes from "stoker/http-status-codes";
config();
expand(config());

const app = createApp();

configureOpenAPI(app);
// Mount Better Auth routes
app.all("/api/auth/*", async (c) => {
  const db = c.get('db');
  const auth = createAuth(db, c.env);
  return auth.handler(c.req.raw);
});

const routes = [
  index,
  hello,
  album,
  publicRoutes,
  profile,
  billing,
  admin,
  plans, // Helper for user plans
] as const;

routes.forEach((route) => {
  app.route("/api/v1", route);
});

export default app;
