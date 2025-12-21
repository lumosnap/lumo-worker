/* eslint-disable node/no-process-env */
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  SCALAR_OPENAPI_CLIENT_KEY: z.string().min(32).max(32),
  SCALAR_OPENAPI_DOC_KEY: z.string().min(32).max(32),
  DATABASE_URL: z.string(),
  SUPABASE_URL: z.string().min(1).max(64),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).max(512),
  GOOGLE_CLIENT_ID: z.string().min(1).max(128),
  GOOGLE_CLIENT_SECRET: z.string().min(1).max(128),
  BETTER_AUTH_SECRET: z.string().min(32).max(128),
  BETTER_AUTH_URL: z.string().min(1).max(256),
  BACKBLAZE_API_KEY_ID: z.string().min(1).max(128),
  BACKBLAZE_API_KEY: z.string().min(1).max(128),
  BACKBLAZE_BUCKET_ID: z.string().min(1).max(128),
  BACKBLAZE_BUCKET_NAME: z.string().min(1).max(128),
  WEB_DOMAIN:z.string()
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);
  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors)
      .map(([key, errors]) => `${key}: ${errors.join(",")}`)
      .join(" | ")}`;
    throw new Error(errorMessage);
  }
  return env;
}
