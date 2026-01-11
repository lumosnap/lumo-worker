import { profiles, billingAddresses } from "@/db/schema/profiles";
import { bookings } from "@/db/schema/bookings";
import { subscriptions, plans } from "@/db/schema/billing";
import type { AppRouteHandler } from "@/lib/types";
import { eq, and, desc, gt } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { GLOBAL_MAX_IMAGES } from "@/lib/constants";
import type {
  GetProfileRoute,
  UpdateProfileRoute,
  GetBillingAddressesRoute,
  CreateBillingAddressRoute,
  UpdateBillingAddressRoute,
  DeleteBillingAddressRoute,
  GetBookingUrlRoute,
  GetBookingsRoute
} from "./profile.routes";

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');

    let [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    // Auto-create profile if it doesn't exist
    if (!profile) {
      const [newProfile] = await db
        .insert(profiles)
        .values({
          userId: user.id,
          businessName: null,
          phone: null,
          storageUsed: 0,
          totalImages: 0,
        })
        .returning();
      profile = newProfile;
    }

    // Get user's subscription and plan limit
    const now = new Date();
    const [subscription] = await db
      .select({
        planName: plans.name,
        planDisplayName: plans.displayName,
        imageLimit: plans.imageLimit,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(
        eq(subscriptions.userId, user.id),
        eq(subscriptions.status, 'active'),
        gt(subscriptions.currentPeriodEnd, now)
      ));

    // Default to Trial limits if no active subscription
    const imageLimit = subscription?.imageLimit ?? 500;
    const planName = subscription?.planDisplayName ?? 'Trial';
    const planExpiry = subscription?.currentPeriodEnd ?? null;

    // Calculate profileCompleted based on businessName
    const profileCompleted = !!profile.businessName && profile.businessName.length > 0;

    return c.json(
      {
        success: true,
        message: "Profile retrieved successfully",
        data: {
          ...profile,
          profileCompleted,
          globalMaxImages: GLOBAL_MAX_IMAGES, // Keep for backwards compatibility
          imageLimit, // User's actual plan-based limit
          planName,
          planExpiry,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving profile",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const patchProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');
    const body = c.req.valid("json");

    // Check if profile exists
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!existingProfile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Update profile with partial data
    const [updatedProfile] = await db
      .update(profiles)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id))
      .returning();

    // Calculate profileCompleted based on businessName
    const profileCompleted = !!updatedProfile.businessName && updatedProfile.businessName.length > 0;

    return c.json(
      {
        success: true,
        message: "Profile updated successfully",
        data: {
          ...updatedProfile,
          profileCompleted,
          globalMaxImages: GLOBAL_MAX_IMAGES,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating profile",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');
    const body = c.req.valid("json");

    // Check if profile exists
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!existingProfile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Update profile
    const [updatedProfile] = await db
      .update(profiles)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, user.id))
      .returning();

    // Calculate profileCompleted based on businessName
    const profileCompleted = !!updatedProfile.businessName && updatedProfile.businessName.length > 0;

    return c.json(
      {
        success: true,
        message: "Profile updated successfully",
        data: {
          ...updatedProfile,
          profileCompleted,
          globalMaxImages: GLOBAL_MAX_IMAGES,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating profile",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getBillingAddresses: AppRouteHandler<GetBillingAddressesRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');

    // First get the profile ID
    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!profile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Get billing addresses
    const addresses = await db
      .select()
      .from(billingAddresses)
      .where(eq(billingAddresses.userId, profile.id))
      .orderBy(desc(billingAddresses.isDefault), desc(billingAddresses.createdAt));

    return c.json(
      {
        success: true,
        message: "Billing addresses retrieved successfully",
        data: addresses,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving billing addresses",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const createBillingAddress: AppRouteHandler<CreateBillingAddressRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');
    const body = c.req.valid("json");

    // Get profile ID
    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!profile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // If this is set as default, unset all other addresses
    if (body.isDefault) {
      await db
        .update(billingAddresses)
        .set({ isDefault: false })
        .where(eq(billingAddresses.userId, profile.id));
    }

    // Create billing address
    const [newAddress] = await db
      .insert(billingAddresses)
      .values({
        userId: profile.id,
        ...body,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Billing address created successfully",
        data: newAddress,
      },
      HttpStatusCodes.CREATED
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem creating billing address",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateBillingAddress: AppRouteHandler<UpdateBillingAddressRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');
    const { addressId } = c.req.valid("param");
    const body = c.req.valid("json");

    // Get profile ID
    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!profile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Check if address exists and belongs to user
    const [existingAddress] = await db
      .select()
      .from(billingAddresses)
      .where(and(eq(billingAddresses.id, parseInt(addressId)), eq(billingAddresses.userId, profile.id)));

    if (!existingAddress) {
      return c.json(
        {
          success: false,
          message: "Billing address not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // If this is set as default, unset all other addresses
    if (body.isDefault) {
      await db
        .update(billingAddresses)
        .set({ isDefault: false })
        .where(and(eq(billingAddresses.userId, profile.id)));
    }

    // Update address
    const [updatedAddress] = await db
      .update(billingAddresses)
      .set(body)
      .where(and(eq(billingAddresses.id, parseInt(addressId)), eq(billingAddresses.userId, profile.id)))
      .returning();

    return c.json(
      {
        success: true,
        message: "Billing address updated successfully",
        data: updatedAddress,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem updating billing address",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const deleteBillingAddress: AppRouteHandler<DeleteBillingAddressRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');
    const { addressId } = c.req.valid("param");

    // Get profile ID
    const [profile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (!profile) {
      return c.json(
        {
          success: false,
          message: "Profile not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Delete address (only if it belongs to user)
    const result = await db
      .delete(billingAddresses)
      .where(and(eq(billingAddresses.id, parseInt(addressId)), eq(billingAddresses.userId, profile.id)))
      .returning();

    if (result.length === 0) {
      return c.json(
        {
          success: false,
          message: "Billing address not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(
      {
        success: true,
        message: "Billing address deleted successfully",
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem deleting billing address",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getBookingUrl: AppRouteHandler<GetBookingUrlRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Generate booking URL using WEB_DOMAIN from env
    const webDomain = c.env.WEB_DOMAIN;
    const bookingUrl = `${webDomain}/booking/${user.id}`;

    return c.json(
      {
        success: true,
        message: "Booking URL generated successfully",
        data: {
          bookingUrl,
        },
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem generating booking URL",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getBookings: AppRouteHandler<GetBookingsRoute> = async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const db = c.get('db');

    const userBookings = await db
      .select()
      .from(bookings)
      .where(eq(bookings.photographerId, user.id))
      .orderBy(desc(bookings.createdAt));

    return c.json(
      {
        success: true,
        message: "Bookings retrieved successfully",
        data: userBookings,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: "Problem retrieving bookings",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};