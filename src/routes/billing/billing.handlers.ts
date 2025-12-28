import { plans, subscriptions } from "@/db/schema/billing";
import type { AppRouteHandler } from "@/lib/types";
import { eq, and, desc } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type {
  GetPlansRoute,
  GetSubscriptionRoute,
  CreateSubscriptionRoute,
  UpdateSubscriptionRoute,
  CancelSubscriptionRoute
} from "./billing.routes";

export const getPlans: AppRouteHandler<GetPlansRoute> = async (c) => {
  try {
    const db = c.get('db');

    const availablePlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(plans.priceMonthly);

    return c.json(
      {
        success: true,
        message: "Plans retrieved successfully",
        data: availablePlans,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving plans",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getSubscription: AppRouteHandler<GetSubscriptionRoute> = async (c) => {
  try {
    const db = c.get('db');

    // Get user ID from session
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json(
        {
          success: false,
          message: "User not authenticated",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const [subscriptionWithPlan] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        plan: {
          id: plans.id,
          name: plans.name,
          displayName: plans.displayName,
          priceMonthly: plans.priceMonthly,
          storageLimit: plans.storageLimit,
          maxAlbums: plans.maxAlbums,
          features: plans.features,
        },
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscriptionWithPlan) {
      return c.json(
        {
          success: false,
          message: "Subscription not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(
      {
        success: true,
        message: "Subscription retrieved successfully",
        data: subscriptionWithPlan,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving subscription",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const createSubscription: AppRouteHandler<CreateSubscriptionRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { planId } = c.req.valid("json");

    // Get user ID from session
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json(
        {
          success: false,
          message: "User not authenticated",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Check if user already has an active subscription
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));

    if (existingSubscription) {
      return c.json(
        {
          success: false,
          message: "User already has an active subscription",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Check if plan exists and is active
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.isActive, true)));

    if (!plan) {
      return c.json(
        {
          success: false,
          message: "Plan not found or inactive",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Create subscription (this would integrate with Stripe in production)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month from now

    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        userId,
        planId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        // stripeSubscriptionId would be set after Stripe integration
      })
      .returning();

    // Return subscription with plan details
    const [subscriptionWithPlan] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        plan: {
          id: plans.id,
          name: plans.name,
          displayName: plans.displayName,
          priceMonthly: plans.priceMonthly,
          storageLimit: plans.storageLimit,
          maxAlbums: plans.maxAlbums,
          features: plans.features,
        },
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.id, newSubscription.id))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Subscription created successfully",
        data: subscriptionWithPlan,
      },
      HttpStatusCodes.CREATED
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem creating subscription",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateSubscription: AppRouteHandler<UpdateSubscriptionRoute> = async (c) => {
  try {
    const db = c.get('db');
    const { planId } = c.req.valid("json");

    // Get user ID from session
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json(
        {
          success: false,
          message: "User not authenticated",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Check if user has an active subscription
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));

    if (!existingSubscription) {
      return c.json(
        {
          success: false,
          message: "No active subscription found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Check if plan exists and is active
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.isActive, true)));

    if (!plan) {
      return c.json(
        {
          success: false,
          message: "Plan not found or inactive",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Update subscription
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({
        planId,
        updatedAt: new Date(),
        // In production, this would handle Stripe subscription update
      })
      .where(eq(subscriptions.id, existingSubscription.id))
      .returning();

    // Return subscription with plan details
    const [subscriptionWithPlan] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        plan: {
          id: plans.id,
          name: plans.name,
          displayName: plans.displayName,
          priceMonthly: plans.priceMonthly,
          storageLimit: plans.storageLimit,
          maxAlbums: plans.maxAlbums,
          features: plans.features,
        },
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.id, updatedSubscription.id))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Subscription updated successfully",
        data: subscriptionWithPlan,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating subscription",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const cancelSubscription: AppRouteHandler<CancelSubscriptionRoute> = async (c) => {
  try {
    const db = c.get('db');

    // Get user ID from session
    const userId = c.get('user')?.id;
    if (!userId) {
      return c.json(
        {
          success: false,
          message: "User not authenticated",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Find active subscription
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));

    if (!existingSubscription) {
      return c.json(
        {
          success: false,
          message: "No active subscription found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Update subscription status to cancelled
    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        // In production, this would handle Stripe subscription cancellation
      })
      .where(eq(subscriptions.id, existingSubscription.id));

    return c.json(
      {
        success: true,
        message: "Subscription cancelled successfully",
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem cancelling subscription",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};