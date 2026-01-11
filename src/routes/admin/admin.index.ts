import { createRouter } from "@/lib/create-app";
import { requireAdmin, requireSuperAdmin } from "@/middlewares/admin";
import * as handlers from "./admin.handlers";
import * as routes from "./admin.routes";

const router = createRouter();

// Apply admin middleware to all admin routes
router.use("/admin/*", requireAdmin);

// Stats - accessible by any admin
router.openapi(routes.getStatsRoute, handlers.getStats);

// List users - accessible by any admin
router.openapi(routes.listUsersRoute, handlers.listUsers);

// Role management - super admin only (apply additional middleware)
router.use("/admin/users/:userId/role", requireSuperAdmin);
router.openapi(routes.setUserRoleRoute, handlers.setUserRole);

export default router;
