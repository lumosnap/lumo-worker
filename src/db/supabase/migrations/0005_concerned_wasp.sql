ALTER TABLE "albums" ALTER COLUMN "id" SET DATA TYPE varchar(25);--> statement-breakpoint
ALTER TABLE "favorites" ALTER COLUMN "album_id" SET DATA TYPE varchar(25);--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "album_id" SET DATA TYPE varchar(25);