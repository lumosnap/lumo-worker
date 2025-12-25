import configureOpenAPI from "@/lib/configure-open-api";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import createApp from "@/lib/create-app";
import hello from "@/routes/hello/hello.index";
import album from "@/routes/album/album.index";
import publicRoutes from "@/routes/public/public.index";
import profile from "@/routes/profile/profile.index";
import billing from "@/routes/billing/billing.index";
import auth from "@/routes/auth/auth.index";
import index from "@/routes/index.route";
import { createAuth } from "@/lib/auth";
import { createDb } from "@/db";
import * as HttpStatusCodes from "stoker/http-status-codes";
config();
expand(config());

const app = createApp();

configureOpenAPI(app);
// Mount Better Auth routes
app.all("/api/auth/*", async (c) => {
  const { db } = createDb(c.env);
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
  auth,
] as const;

routes.forEach((route) => {
  app.route("/api/v1", route);
});

export default app;
