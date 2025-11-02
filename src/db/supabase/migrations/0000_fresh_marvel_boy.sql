CREATE TABLE "test_table" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "test_table_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"email" varchar(100),
	"message" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_table_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "name_idx" ON "test_table" USING btree ("name");--> statement-breakpoint
CREATE INDEX "email_idx" ON "test_table" USING btree ("email");