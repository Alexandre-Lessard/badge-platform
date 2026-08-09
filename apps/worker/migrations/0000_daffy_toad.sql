CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text,
	`phone` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `insurance_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`insurer_name` text NOT NULL,
	`message_content` text NOT NULL,
	`sent_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`file_name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_documents_item_id_idx` ON `item_documents` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_photos_item_id_idx` ON `item_photos` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`brand` text,
	`model` text,
	`year` integer,
	`serial_number` text,
	`tracker_id` text,
	`estimated_value` integer,
	`purchase_date` integer,
	`is_insured` integer DEFAULT false NOT NULL,
	`insurer_id` text,
	`insurer_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`badge_code` text,
	`archived_at` integer,
	`archive_reason` text,
	`archive_reason_custom` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_badge_code_unique` ON `items` (`badge_code`);--> statement-breakpoint
CREATE INDEX `items_owner_id_idx` ON `items` (`owner_id`);--> statement-breakpoint
CREATE INDEX `items_badge_code_idx` ON `items` (`badge_code`);--> statement-breakpoint
CREATE INDEX `items_status_idx` ON `items` (`status`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`item_id` text,
	`product_id` text,
	`badge_code` text,
	`product_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_item_id_idx` ON `order_items` (`item_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`total_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`shipping_name` text,
	`shipping_address` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_session_id_unique` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_stripe_session_id_idx` ON `orders` (`stripe_session_id`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`type` text NOT NULL,
	`contact_email` text,
	`contact_phone` text,
	`website` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_fr` text NOT NULL,
	`name_en` text NOT NULL,
	`description_fr` text,
	`description_en` text,
	`features_fr` text,
	`features_en` text,
	`price_cents` integer NOT NULL,
	`stripe_price_id` text,
	`image_urls` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`requires_item` integer DEFAULT false NOT NULL,
	`custom_mechanic` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_sort_order_idx` ON `products` (`sort_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_info` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `sticker_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`order_item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_item_id` text,
	`created_at` integer NOT NULL,
	`claimed_at` integer,
	`voided_at` integer,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sticker_codes_user_id_idx` ON `sticker_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `sticker_codes_order_item_id_idx` ON `sticker_codes` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `sticker_codes_assigned_item_id_idx` ON `sticker_codes` (`assigned_item_id`);--> statement-breakpoint
CREATE TABLE `theft_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`police_report_number` text,
	`theft_date` integer,
	`theft_location` text,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `theft_reports_item_id_idx` ON `theft_reports` (`item_id`);--> statement-breakpoint
CREATE INDEX `theft_reports_reporter_id_idx` ON `theft_reports` (`reporter_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`contact_email` text,
	`password_hash` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text,
	`address_1` text,
	`address_2` text,
	`city` text,
	`province` text,
	`postal_code` text,
	`country` text,
	`google_id` text,
	`microsoft_id` text,
	`facebook_id` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`client_number` text,
	`preferred_language` text DEFAULT 'fr' NOT NULL,
	`terms_accepted_at` integer,
	`token_revoked_before` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_microsoft_id_unique` ON `users` (`microsoft_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_facebook_id_unique` ON `users` (`facebook_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_client_number_unique` ON `users` (`client_number`);