import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer } from "better-auth/plugins";
import type { Environment } from "@/env";
import { profiles } from "@/db/schema/profiles";
import { subscriptions, plans } from "@/db/schema/billing";

import { eq } from "drizzle-orm";
import { user } from "@/db/schema/auth";

export function createAuth(db: any, env: Environment) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg"
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // ... socialProviders, secret, baseURL, etc ...
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`, // Backend callback
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: ["http://localhost:3000", "http://localhost:5173", env.WEB_DOMAIN, env.ONBOARDING_URL, env.ADMIN_DOMAIN],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days total session lifetime in database
      updateAge: 60 * 60 * 24, // Update session after 1 day of inactivity
      cookieCache: {
        enabled: true,
        maxAge: 15 * 60, // 15 minutes - short-lived access token
        strategy: "jwt", // Standard JWT with signature (HS256)
        refreshCache: {
          updateAge: 5 * 60, // Refresh when 5 minutes remain before expiry
        },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
      },
    },
    plugins: [
      admin({
        adminRoles: ["superadmin", "admin", "staff"], // superadmin, admin, and staff have admin-level permissions
      }),
      bearer(),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (item) => {
            // Auto-create profile for new users
            await db.insert(profiles).values({
              userId: item.id,
            }).onConflictDoNothing();

            // Auto-assign Trial subscription
            const [trialPlan] = await db.select().from(plans).where(eq(plans.name, 'trial'));
            if (trialPlan) {
              const now = new Date();
              const expiresAt = new Date(now);
              expiresAt.setFullYear(now.getFullYear() + 1); // 1 year trial

              await db.insert(subscriptions).values({
                userId: item.id,
                planId: trialPlan.id,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: expiresAt,
              }).onConflictDoNothing();
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            // Check if user is super admin
            const [currentUser] = await db.select().from(user).where(eq(user.id, session.userId));

            if (currentUser && currentUser.email === env.SUPER_ADMIN_EMAIL) {
              const currentRoles = currentUser.role ? currentUser.role.split(',').map((r: string) => r.trim()) : [];

              if (!currentRoles.includes('superadmin')) {
                // Add superadmin role
                const newRoles = [...currentRoles, 'superadmin'].filter(Boolean).join(',');
                await db.update(user).set({ role: newRoles }).where(eq(user.id, session.userId));
              }
            }
            return { data: session };
          }
        }
      }
    },
  });
}
