CREATE TABLE "sticker_codes" (
	"code" varchar(13) PRIMARY KEY NOT NULL,
	"order_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sticker_codes" ADD CONSTRAINT "sticker_codes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticker_codes" ADD CONSTRAINT "sticker_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticker_codes" ADD CONSTRAINT "sticker_codes_assigned_item_id_items_id_fk" FOREIGN KEY ("assigned_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sticker_codes_user_id_idx" ON "sticker_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sticker_codes_order_item_id_idx" ON "sticker_codes" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "sticker_codes_assigned_item_id_idx" ON "sticker_codes" USING btree ("assigned_item_id");