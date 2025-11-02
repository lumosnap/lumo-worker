import { createRouter } from "@/lib/create-app";
import * as handlers from "./hello.handlers";
import * as routes from "./hello.routes";

const router = createRouter()
  .openapi(routes.listTestsRoute, handlers.listTests)
  .openapi(routes.getTestRoute, handlers.getTest)
  .openapi(routes.createTestRoute, handlers.createTest);

export default router;
