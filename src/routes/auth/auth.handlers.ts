import { createDb } from "@/db";
import { createAuth } from "@/lib/auth";
import type { AppRouteHandler } from "@/lib/types";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { GoogleDesktopAuthRoute } from "./auth.routes";

export const googleDesktopAuth: AppRouteHandler<GoogleDesktopAuthRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { code } = await c.req.json();

    if (!code) {
      return c.json(
        {
          success: false,
          message: "Missing code",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const auth = createAuth(db, c.env);

    const result = await auth.signIn.social({
      provider: "google",
      code,
    });

    return c.json(
      {
        user: result.user,
        session: result.session,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: error.message || "Problem authenticating with Google",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
