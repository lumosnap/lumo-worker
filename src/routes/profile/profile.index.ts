import { createRouter } from "@/lib/create-app";
import * as handlers from "./profile.handlers";
import * as routes from "./profile.routes";

const router = createRouter()
  .openapi(routes.getProfileRoute, handlers.getProfile)
  .openapi(routes.updateProfileRoute, handlers.updateProfile)
  .openapi(routes.patchProfileRoute, handlers.patchProfile)
  .openapi(routes.getBillingAddressesRoute, handlers.getBillingAddresses)
  .openapi(routes.createBillingAddressRoute, handlers.createBillingAddress)
  .openapi(routes.updateBillingAddressRoute, handlers.updateBillingAddress)
  .openapi(routes.deleteBillingAddressRoute, handlers.deleteBillingAddress)
  .openapi(routes.getBookingUrlRoute, handlers.getBookingUrl)
  .openapi(routes.getBookingsRoute, handlers.getBookings);

export default router;