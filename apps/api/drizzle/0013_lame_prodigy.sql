ALTER TABLE "products" ADD COLUMN "image_urls" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "products"
SET "image_urls" = ARRAY[
  '/assets/product-stickers.webp',
  '/assets/product-stickers-closeup.webp',
  '/assets/product-stickers-detail.webp'
]
WHERE "slug" = 'sticker-sheet';--> statement-breakpoint
UPDATE "products"
SET "image_urls" = ARRAY['/assets/product-door-sticker.webp']
WHERE "slug" = 'door-sticker';--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "image_url";