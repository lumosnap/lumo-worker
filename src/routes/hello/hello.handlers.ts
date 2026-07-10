import { testTable } from "@/db/d1-schema";
import type { AppRouteHandler } from "@/lib/types";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { CreateTestRoute, GetTestRoute, ListTestsRoute } from "./hello.routes";

// Get all tests
export const listTests: AppRouteHandler<ListTestsRoute> = async (c) => {

  const db = c.get('db');
  const tests = await db.select().from(testTable);

  return c.json(
    {
      success: true,
      message: "Tests fetched successfully",
      data: tests,
    },
    HttpStatusCodes.OK
  );
};

// Get single test by ID
export const getTest: AppRouteHandler<GetTestRoute> = async (c) => {
  const db = c.get('db');
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
};

// Create test
export const createTest: AppRouteHandler<CreateTestRoute> = async (c) => {
  const db = c.get('db');
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
};
