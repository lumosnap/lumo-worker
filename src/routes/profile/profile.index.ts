import { createRouter } from "@/lib/create-app";
import * as handlers from "./profile.handlers";
import * as routes from "./profile.routes";

const router = createRouter()
  .openapi(routes.getProfileRoute, handlers.getProfile)
  .openapi(routes.updateProfileRoute, handlers.updateProfile)
  .openapi(routes.getBillingAddressesRoute, handlers.getBillingAddresses)
  .openapi(routes.createBillingAddressRoute, handlers.createBillingAddress)
  .openapi(routes.updateBillingAddressRoute, handlers.updateBillingAddress)
  .openapi(routes.deleteBillingAddressRoute, handlers.deleteBillingAddress);

export default router;