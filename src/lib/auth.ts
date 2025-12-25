import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { Environment } from "@/env";
import { profiles } from "@/db/schema/profiles";

export function createAuth(db: any, env: Environment) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg"
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_DESKTOP_CLIENT_ID,
        clientSecret: env.GOOGLE_DESKTOP_CLIENT_SECRET,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: ["http://localhost:3000", "http://localhost:5173", env.WEB_DOMAIN],
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
      },
    },
    plugins: [
      admin({
        adminRoles: ["admin", "staff"],
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.insert(profiles).values({
              userId: user.id,
            }).onConflictDoNothing();
          },
        },
      },
    },
  });
}
