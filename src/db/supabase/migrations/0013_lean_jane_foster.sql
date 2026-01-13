ALTER TABLE "images" RENAME COLUMN "b2_file_id" TO "source_image_hash";--> statement-breakpoint
DROP INDEX "images_b2_file_id_idx";--> statement-breakpoint
CREATE INDEX "images_source_image_hash_idx" ON "images" USING btree ("source_image_hash");