import { createRouter } from "@/lib/create-app";
import * as handlers from "./plans.handlers";
import * as routes from "./plans.routes";

const router = createRouter()
    .openapi(routes.listPublicPlans, handlers.listPublicPlansHandler)
    .openapi(routes.requestUpgrade, handlers.requestUpgradeHandler);

export default router;
