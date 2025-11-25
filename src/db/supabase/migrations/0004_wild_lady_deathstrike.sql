CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploading', 'complete', 'failed');--> statement-breakpoint
ALTER TABLE "thumbnails" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "thumbnails" CASCADE;--> statement-breakpoint
DROP INDEX "favorites_album_image_client_idx";--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "thumbnail_b2_file_id" varchar(255);--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "thumbnail_b2_file_name" varchar(500);--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "upload_status" "upload_status" DEFAULT 'pending';--> statement-breakpoint
CREATE INDEX "images_b2_file_id_idx" ON "images" USING btree ("b2_file_id");--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_unique" UNIQUE("album_id","image_id","client_name");