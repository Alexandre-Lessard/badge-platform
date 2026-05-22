-- Rebrand RNBP → Badge.
--
-- Stickers were not yet printed and no codes have been claimed by real
-- customers, so we clear stale dev data, rename the columns, expand the
-- length to fit "BADGE-XXXXXXXX" (14 chars), and refresh product copy.

-- 1. Clear stale RNBP-format codes (dev/test data; nothing in production scope).
TRUNCATE TABLE sticker_codes CASCADE;
UPDATE items SET rnbp_number = NULL WHERE rnbp_number IS NOT NULL;
UPDATE order_items SET rnbp_number = NULL WHERE rnbp_number IS NOT NULL;

-- 2. items.rnbp_number → items.badge_code (varchar 13 → 15).
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_rnbp_number_unique;
DROP INDEX IF EXISTS items_rnbp_number_idx;
ALTER TABLE items RENAME COLUMN rnbp_number TO badge_code;
ALTER TABLE items ALTER COLUMN badge_code TYPE varchar(15);
ALTER TABLE items ADD CONSTRAINT items_badge_code_unique UNIQUE (badge_code);
CREATE INDEX items_badge_code_idx ON items (badge_code);

-- 3. order_items.rnbp_number → order_items.badge_code.
ALTER TABLE order_items RENAME COLUMN rnbp_number TO badge_code;
ALTER TABLE order_items ALTER COLUMN badge_code TYPE varchar(15);

-- 4. sticker_codes.code stays named "code" but widens to varchar(15).
ALTER TABLE sticker_codes ALTER COLUMN code TYPE varchar(15);

-- 5. Refresh product copy for the sticker-sheet product.
UPDATE products
SET
  description_fr = 'Chaque feuille contient 10 codes Badge uniques que vous assignez vous-même à vos objets depuis votre tableau de bord.',
  description_en = 'Each sheet contains 10 unique Badge codes that you assign yourself to your items from your dashboard.',
  features_fr = ARRAY['10 autocollants uniques', 'Codes Badge à associer à vos objets', 'Matériau durable', 'Livraison incluse partout au Canada'],
  features_en = ARRAY['10 unique stickers', 'Badge codes to assign to your items', 'Durable material', 'Free shipping across Canada'],
  updated_at = NOW()
WHERE slug = 'sticker-sheet';
