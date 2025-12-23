-- Step 1: Drop the old foreign key constraint
ALTER TABLE "albums" DROP CONSTRAINT IF EXISTS "albums_user_id_profiles_id_fk";
--> statement-breakpoint

-- Step 2: Change column type from integer to text first (before data migration)
ALTER TABLE "albums" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
--> statement-breakpoint

-- Step 3: Migrate existing data - convert old profiles.id references to user.id
UPDATE "albums" a
SET "user_id" = p."user_id"
FROM "profiles" p
WHERE a."user_id" = p."id"::text;
--> statement-breakpoint

-- Step 4: Add the new foreign key constraint referencing user.id
ALTER TABLE "albums" ADD CONSTRAINT "albums_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;