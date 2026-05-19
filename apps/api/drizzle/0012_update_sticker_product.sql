-- Sticker sheets are now generic packs of 10 customer-assignable codes.
-- Remove the item-linked-stickers custom mechanic and requires_item flag,
-- and refresh the localized copy to reflect the new sheet size.

UPDATE products
SET
  custom_mechanic = NULL,
  requires_item = false,
  description_fr = 'Chaque feuille contient 10 codes RNBP uniques que vous assignez vous-même à vos biens depuis votre tableau de bord.',
  description_en = 'Each sheet contains 10 unique RNBP codes that you assign yourself to your items from your dashboard.',
  features_fr = ARRAY['10 autocollants uniques', 'Codes RNBP à associer à vos biens', 'Matériau durable', 'Livraison incluse partout au Canada'],
  features_en = ARRAY['10 unique stickers', 'RNBP codes to assign to your items', 'Durable material', 'Free shipping across Canada'],
  updated_at = NOW()
WHERE slug = 'sticker-sheet';
