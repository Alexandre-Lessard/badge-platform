-- Wave 1 Badge updates:
--   #5  users.contact_email  — optional public-facing contact email (relay target)
--   #15 items insurance      — is_insured / insurer_id / insurer_name
ALTER TABLE "users" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_insured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "insurer_id" varchar(50);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "insurer_name" varchar(100);
