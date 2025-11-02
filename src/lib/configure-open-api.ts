import { apiReference } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "./types";

import packageJSON from "../../package.json";


export default function configureOpenAPI(app: AppOpenAPI) {


  app.openAPIRegistry.registerComponent('responses', 'UnauthorizedError', {
    description: "Authentication error, access denied",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Unauthorized. Please provide a valid token.",
            },
          },
        },
      },
    }
  });

  app.openAPIRegistry.registerComponent('examples', 'InvalidToken', {
    "success": false,
    "message": "Unauthorized: Invalid or missing token"
  });

  app.openAPIRegistry.registerComponent('examples', 'JwtTokenExpired', {
    "success": false,
    "message": "Unauthorized: Token has expired"
  });

  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "LumoSnap API",
    },
    security: [{
      Bearer: []
    }]
  });

  app.get(
    "/reference",
    apiReference({
      theme: "kepler",
      layout: "modern",
      defaultHttpClient: {
        targetKey: "javascript",
        clientKey: "fetch",
      },
      spec: {
        url: "/doc?key=E$p7C$60qfhe*hhZeZD2BKhhvJ2Dxe*v",
      },
    }),
  );
}
