CREATE TABLE "thumbnails" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" integer NOT NULL,
	"b2_file_id" varchar(255) NOT NULL,
	"b2_file_name" varchar(500) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "width" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "height" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "thumbnails_image_id_idx" ON "thumbnails" USING btree ("image_id");