import configureOpenAPI from "@/lib/configure-open-api";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import createApp from "@/lib/create-app";
import hello from "@/routes/hello/hello.index";
import index from "@/routes/index.route";
config();
expand(config());

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  hello,
] as const;
routes.forEach((route) => {
  app.route("/api/v1", route);
});
export default app;
