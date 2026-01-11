import { createRouter } from "@/lib/create-app";
import * as handlers from "./plans.handlers";
import * as routes from "./plans.routes";

const router = createRouter()
    .openapi(routes.listPlans, handlers.listPlansHandler)
    .openapi(routes.createPlan, handlers.createPlanHandler)
    .openapi(routes.updatePlan, handlers.updatePlanHandler)
    .openapi(routes.listUpgradeRequests, handlers.listUpgradeRequestsHandler)
    .openapi(routes.approveUpgradeRequest, handlers.approveUpgradeRequestHandler)
    .openapi(routes.rejectUpgradeRequest, handlers.rejectUpgradeRequestHandler);

export default router;
