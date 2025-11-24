import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "@/env";

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
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`, // Backend callback
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: ["http://localhost:3000"],
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
      },
    },
  });
}
