import { AppRouteHandler } from "@/lib/types";
import { plans, planRequests } from "@/db/d1-schema/billing";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { eq, and } from "drizzle-orm";
import type { ListPublicPlansRoute, RequestUpgradeRoute } from "./plans.routes";

export const listPublicPlansHandler: AppRouteHandler<ListPublicPlansRoute> = async (c) => {
    const db = c.get("db");
    const activePlans = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.id);

    const formattedPlans = activePlans.map(plan => ({
        ...plan,
        priceMonthly: plan.priceMonthly ? String(plan.priceMonthly) : "0.00",
        description: plan.description || undefined,
    }));

    return c.json({ success: true, data: formattedPlans }, HttpStatusCodes.OK);
};

export const requestUpgradeHandler: AppRouteHandler<RequestUpgradeRoute> = async (c) => {
    const user = c.get("user");
    if (!user) {
        return c.json({ success: false, message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const db = c.get("db");
    const { planId } = c.req.valid("json");

    // Verify plan exists
    const [targetPlan] = await db.select().from(plans).where(eq(plans.id, planId));
    if (!targetPlan) {
        return c.json({ success: false, message: "Plan not found" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Check for existing pending request
    const [existingRequest] = await db.select()
        .from(planRequests)
        .where(and(
            eq(planRequests.userId, user.id),
            eq(planRequests.status, 'pending')
        ));

    if (existingRequest) {
        return c.json({ success: false, message: "You already have a pending upgrade request." }, HttpStatusCodes.BAD_REQUEST);
    }

    await db.insert(planRequests).values({
        userId: user.id,
        planId: planId,
        status: 'pending',
    });

    return c.json({ success: true, message: "Upgrade request submitted successfully." }, HttpStatusCodes.CREATED);
};
