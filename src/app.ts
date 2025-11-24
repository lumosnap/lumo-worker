import configureOpenAPI from "@/lib/configure-open-api";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import createApp from "@/lib/create-app";
import hello from "@/routes/hello/hello.index";
import index from "@/routes/index.route";
import { createAuth } from "@/lib/auth";
import { createDb } from "@/db";

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
] as const;

routes.forEach((route) => {
  app.route("/api/v1", route);
});

export default app;
