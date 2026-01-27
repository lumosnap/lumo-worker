import { AppRouteHandler } from "@/lib/types";
import { plans, planRequests, subscriptions } from "@/db/d1-schema/billing";
import { user as userTable } from "@/db/d1-schema/auth";
import { profiles } from "@/db/d1-schema/profiles";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { eq, desc, and } from "drizzle-orm";
import type {
    ListPlansRoute,
    CreatePlanRoute,
    UpdatePlanRoute,
    ListUpgradeRequestsRoute,
    ApproveUpgradeRequestRoute,
    RejectUpgradeRequestRoute,
} from "./plans.routes";

export const listPlansHandler: AppRouteHandler<ListPlansRoute> = async (c) => {
    const db = c.get("db");
    const allPlans = await db.select().from(plans).orderBy(plans.id);

    const formattedPlans = allPlans.map(plan => ({
        ...plan,
        priceMonthly: plan.priceMonthly ? String(plan.priceMonthly) : "0.00",
        description: plan.description || undefined,
        isActive: plan.isActive ?? undefined,
    }));

    return c.json({ success: true, data: formattedPlans }, HttpStatusCodes.OK);
};

export const createPlanHandler: AppRouteHandler<CreatePlanRoute> = async (c) => {
    const db = c.get("db");
    const body = c.req.valid("json");

    const [newPlan] = await db.insert(plans).values({
        name: body.name,
        displayName: body.displayName,
        imageLimit: body.imageLimit,
        priceMonthly: body.priceMonthly ?? 0,
        description: body.description,
        isActive: body.isActive ?? true,
    }).returning();

    const formattedPlan = {
        ...newPlan,
        priceMonthly: newPlan.priceMonthly ? String(newPlan.priceMonthly) : "0",
        description: newPlan.description || undefined,
        isActive: newPlan.isActive ?? undefined,
    };

    return c.json({ success: true, data: formattedPlan }, HttpStatusCodes.CREATED);
};

export const updatePlanHandler: AppRouteHandler<UpdatePlanRoute> = async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    // Check if plan exists
    const [existingPlan] = await db.select().from(plans).where(eq(plans.id, id));
    if (!existingPlan) {
        return c.json({ success: false, message: "Plan not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.imageLimit !== undefined) updateData.imageLimit = body.imageLimit;
    if (body.priceMonthly !== undefined) updateData.priceMonthly = body.priceMonthly;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const [updatedPlan] = await db.update(plans).set(updateData).where(eq(plans.id, id)).returning();

    const formattedPlan = {
        ...updatedPlan,
        priceMonthly: updatedPlan.priceMonthly ? String(updatedPlan.priceMonthly) : "0",
        description: updatedPlan.description || undefined,
        isActive: updatedPlan.isActive ?? undefined,
    };

    return c.json({ success: true, data: formattedPlan }, HttpStatusCodes.OK);
};

export const listUpgradeRequestsHandler: AppRouteHandler<ListUpgradeRequestsRoute> = async (c) => {
    const db = c.get("db");
    const query = c.req.valid("query");

    let conditions = undefined;
    if (query.status) {
        conditions = eq(planRequests.status, query.status);
    }

    // Fetch requests with user and plan details
    const requests = await db
        .select({
            id: planRequests.id,
            userId: planRequests.userId,
            planId: planRequests.planId,
            status: planRequests.status,
            durationMonths: planRequests.durationMonths,
            createdAt: planRequests.createdAt,
            user_name: userTable.name,
            user_email: userTable.email,
            plan_name: plans.name,
            plan_displayName: plans.displayName,
        })
        .from(planRequests)
        .leftJoin(userTable, eq(planRequests.userId, userTable.id))
        .leftJoin(plans, eq(planRequests.planId, plans.id))
        .where(conditions)
        .orderBy(desc(planRequests.createdAt));

    const formattedRequests = requests.map(r => ({
        id: r.id,
        userId: r.userId,
        planId: r.planId,
        status: r.status as "pending" | "approved" | "rejected",
        durationMonths: r.durationMonths,
        createdAt: r.createdAt!,
        user: {
            name: r.user_name,
            email: r.user_email!,
        },
        plan: {
            name: r.plan_name!,
            displayName: r.plan_displayName!,
        }
    }));

    return c.json({ success: true, data: formattedRequests }, HttpStatusCodes.OK);
};

export const approveUpgradeRequestHandler: AppRouteHandler<ApproveUpgradeRequestRoute> = async (c) => {
    const db = c.get("db");
    const adminUser = c.get("user")!;
    const requestId = c.req.valid("param").id;
    const body = c.req.valid("json");

    // 1. Initial Reads (outside of transaction/batch)
    const [request] = await db.select().from(planRequests).where(eq(planRequests.id, requestId));

    if (!request) {
        return c.json({ success: false, message: "Request not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const durationMonths = body.durationMonths || 12; // Default to 12 if not provided
    const now = new Date();

    const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, request.userId));

    // 2. Logic Calculation
    let currentPeriodStart = now;
    let currentPeriodEnd = new Date(now);

    if (existingSub && existingSub.currentPeriodEnd > now) {
        // If active and not expired, extend from existing end date
        currentPeriodStart = existingSub.currentPeriodEnd;
        currentPeriodEnd = new Date(existingSub.currentPeriodEnd);
    }

    // Add duration
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + durationMonths);

    // 3. Construct Queries for Batch
    const batchOps = [];

    if (existingSub) {
        batchOps.push(
            db.update(subscriptions).set({
                planId: request.planId,
                status: 'active',
                currentPeriodStart: currentPeriodStart,
                currentPeriodEnd: currentPeriodEnd,
                updatedAt: now,
            }).where(eq(subscriptions.id, existingSub.id))
        );
    } else {
        batchOps.push(
            db.insert(subscriptions).values({
                userId: request.userId,
                planId: request.planId,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: currentPeriodEnd,
            })
        );
    }

    batchOps.push(
        db.update(planRequests).set({
            status: 'approved',
            adminNotes: body.adminNotes,
            reviewedBy: adminUser.id,
            reviewedAt: now,
            updatedAt: now,
        }).where(eq(planRequests.id, requestId))
    );

    // 4. Execute Batch
    await db.batch(batchOps as [any, any]);

    return c.json({ success: true, message: "Request approved and subscription updated" }, HttpStatusCodes.OK);
};

export const rejectUpgradeRequestHandler: AppRouteHandler<RejectUpgradeRequestRoute> = async (c) => {
    const db = c.get("db");
    const adminUser = c.get("user")!;
    const requestId = c.req.valid("param").id;
    const body = c.req.valid("json");

    const [request] = await db.select().from(planRequests).where(eq(planRequests.id, requestId));

    if (!request) {
        return c.json({ success: false, message: "Request not found" }, HttpStatusCodes.NOT_FOUND);
    }

    await db.update(planRequests).set({
        status: 'rejected',
        adminNotes: body.adminNotes,
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(planRequests.id, requestId));

    return c.json({ success: true, message: "Request rejected" }, HttpStatusCodes.OK);
};
