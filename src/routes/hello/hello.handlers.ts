import { createDb } from "@/db";
import { testTable } from "@/db/schema";
import type { AppRouteHandler } from "@/lib/types";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateTestRoute, GetTestRoute, ListTestsRoute } from "./hello.routes";

// Get all tests
export const listTests: AppRouteHandler<ListTestsRoute> = async (c) => {
  try {

    const { db } = createDb(c.env);

    const tests = await db.select().from(testTable);
 console.log("Fetching tests...",tests);

    return c.json(
      {
        success: true,
        message: "Tests fetched successfully",
        data: tests,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: "Problem fetching tests",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get single test by ID
export const getTest: AppRouteHandler<GetTestRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const { id } = c.req.valid("param");

    const [test] = await db
      .select()
      .from(testTable)
      .where(eq(testTable.id, id))
      .limit(1);

    if (!test) {
      return c.json(
        {
          success: false,
          message: "Test entry not found",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(
      {
        success: true,
        message: "Test entry fetched successfully",
        data: test,
      },
      HttpStatusCodes.OK
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: "Problem fetching test entry",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Create test
export const createTest: AppRouteHandler<CreateTestRoute> = async (c) => {
  try {
    const { db } = createDb(c.env);
    const body = c.req.valid("json");

    const [newTest] = await db
      .insert(testTable)
      .values({
        name: body.name,
        email: body.email,
        message: body.message,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Test entry created successfully",
        data: newTest,
      },
      HttpStatusCodes.CREATED
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: "Problem creating test entry",
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
