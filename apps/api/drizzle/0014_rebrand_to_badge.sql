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

-- 5. Refresh product copy across ALL products: replace RNBP / NRPP / long forms with "Badge".
--    Covers name, description and features arrays in both FR and EN.
UPDATE products
SET
  name_fr = REPLACE(REPLACE(REPLACE(REPLACE(name_fr,
    'Registre National des Biens Personnels', 'Badge'),
    'Registre national des biens personnels', 'Badge'),
    'RNBP', 'Badge'),
    'NRPP', 'Badge'),
  name_en = REPLACE(REPLACE(REPLACE(REPLACE(name_en,
    'National Registry of Personal Property', 'Badge'),
    'National registry of personal property', 'Badge'),
    'NRPP', 'Badge'),
    'RNBP', 'Badge'),
  description_fr = REPLACE(REPLACE(REPLACE(REPLACE(description_fr,
    'Registre National des Biens Personnels', 'Badge'),
    'Registre national des biens personnels', 'Badge'),
    'RNBP', 'Badge'),
    'NRPP', 'Badge'),
  description_en = REPLACE(REPLACE(REPLACE(REPLACE(description_en,
    'National Registry of Personal Property', 'Badge'),
    'National registry of personal property', 'Badge'),
    'NRPP', 'Badge'),
    'RNBP', 'Badge'),
  features_fr = ARRAY(
    SELECT REPLACE(REPLACE(REPLACE(REPLACE(f,
      'Registre National des Biens Personnels', 'Badge'),
      'Registre national des biens personnels', 'Badge'),
      'RNBP', 'Badge'),
      'NRPP', 'Badge')
    FROM unnest(features_fr) f
  ),
  features_en = ARRAY(
    SELECT REPLACE(REPLACE(REPLACE(REPLACE(f,
      'National Registry of Personal Property', 'Badge'),
      'National registry of personal property', 'Badge'),
      'NRPP', 'Badge'),
      'RNBP', 'Badge')
    FROM unnest(features_en) f
  ),
  updated_at = NOW()
WHERE name_fr ILIKE '%RNBP%' OR name_fr ILIKE '%NRPP%' OR name_fr ILIKE '%Registre National%' OR name_fr ILIKE '%Registre national%'
   OR name_en ILIKE '%RNBP%' OR name_en ILIKE '%NRPP%' OR name_en ILIKE '%National Registry%' OR name_en ILIKE '%National registry%'
   OR description_fr ILIKE '%RNBP%' OR description_fr ILIKE '%NRPP%' OR description_fr ILIKE '%Registre National%' OR description_fr ILIKE '%Registre national%'
   OR description_en ILIKE '%RNBP%' OR description_en ILIKE '%NRPP%' OR description_en ILIKE '%National Registry%' OR description_en ILIKE '%National registry%'
   OR features_fr::text ILIKE '%RNBP%' OR features_fr::text ILIKE '%NRPP%' OR features_fr::text ILIKE '%Registre%'
   OR features_en::text ILIKE '%RNBP%' OR features_en::text ILIKE '%NRPP%' OR features_en::text ILIKE '%National Registry%';
