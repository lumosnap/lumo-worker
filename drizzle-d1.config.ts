// D1 (SQLite) Drizzle configuration
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/d1-schema",
    out: "./src/db/d1-migrations",
    dialect: "sqlite",
});
