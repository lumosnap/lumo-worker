import { createRouter } from "@/lib/create-app";
import * as handlers from "./billing.handlers";
import * as routes from "./billing.routes";

const router = createRouter()
  .openapi(routes.getPlansRoute, handlers.getPlans) // Public - no auth needed
  .openapi(routes.getSubscriptionRoute, handlers.getSubscription)
  .openapi(routes.createSubscriptionRoute, handlers.createSubscription)
  .openapi(routes.updateSubscriptionRoute, handlers.updateSubscription)
  .openapi(routes.cancelSubscriptionRoute, handlers.cancelSubscription);

export default router;