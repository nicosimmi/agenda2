CREATE TABLE "business_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_media" ADD CONSTRAINT "business_media_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_media" ADD CONSTRAINT "business_media_staff_fk" FOREIGN KEY ("staff_id","business_id") REFERENCES "public"."staff"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_media_staff_unique" ON "business_media" USING btree ("staff_id") WHERE "business_media"."staff_id" is not null;--> statement-breakpoint
CREATE INDEX "business_media_business_idx" ON "business_media" USING btree ("business_id");