// development configuration

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.dev" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // eslint-disable-next-line node/no-process-env
    url: process.env.DATABASE_URL!,
  },
});
