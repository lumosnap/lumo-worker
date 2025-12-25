import { createDb } from "@/db";
import { createAuth } from "@/lib/auth";
import type { AppRouteHandler } from "@/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { GoogleDesktopAuthRoute } from "./auth.routes";

type BetterAuthSuccess = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  token: string;
  redirect: boolean;
  url?: undefined;
};

type BetterAuthRedirect = {
  url: string;
  redirect: boolean;
};

function isAuthSuccess(v: any): v is BetterAuthSuccess {
  return v && typeof v === "object" && "user" in v && !!v.user;
}

export const googleDesktopAuth: AppRouteHandler<GoogleDesktopAuthRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const auth = createAuth(db, c.env);

    const { idToken } = c.req.valid("json");

    const result = await auth.api.signInSocial({
      body: {
        provider: "google",
        idToken: { token: idToken },
        disableRedirect: true,
      },
    });

    // Narrow with a type-guard that TS understands
    if (!isAuthSuccess(result)) {
      // result is likely the redirect shape: { url, redirect: true }
      const redirectUrl = (result as BetterAuthRedirect).url ?? null;
      return c.json(
        {
          success: false,
          message: "Unexpected redirect response from auth provider",
          redirectUrl,
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // TS now knows `result` is BetterAuthSuccess
    const { user, token } = result;

    return c.json(
      {
        success: true,
        user,
        token,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.error("Google auth error:", error);
    return c.json(
      {
        success: false,
        message: error?.message ?? "Authentication failed",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
