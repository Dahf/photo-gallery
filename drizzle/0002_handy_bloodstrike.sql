CREATE TABLE "gallery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"photo_id" uuid,
	"event_type" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_events" ADD CONSTRAINT "gallery_events_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_events" ADD CONSTRAINT "gallery_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_gallery_type_time_idx" ON "gallery_events" USING btree ("gallery_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "events_gallery_photo_idx" ON "gallery_events" USING btree ("gallery_id","photo_id","event_type");--> statement-breakpoint
CREATE INDEX "events_gallery_session_idx" ON "gallery_events" USING btree ("gallery_id","session_id");