CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"photographer_id" text NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"event_date" date NOT NULL,
	"location" varchar(500) NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_photographer_id_user_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_photographer_id_idx" ON "bookings" USING btree ("photographer_id");--> statement-breakpoint
CREATE INDEX "bookings_event_date_idx" ON "bookings" USING btree ("event_date");