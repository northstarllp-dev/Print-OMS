-- Multiple pricing: each threshold band has its own billing type (per_unit | per_sqft).
-- Amounts stay in price_per_unit (≤ threshold) and price_per_sqft (> threshold).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_type_below text,
  ADD COLUMN IF NOT EXISTS pricing_type_above text;

COMMENT ON COLUMN public.products.pricing_type_below IS
  'For Multiple pricing: billing type at/below unit_price_max_sqft (per_unit | per_sqft). Amount in price_per_unit.';

COMMENT ON COLUMN public.products.pricing_type_above IS
  'For Multiple pricing: billing type above unit_price_max_sqft (per_unit | per_sqft). Amount in price_per_sqft.';

-- Existing Multiple products were unit-below / sqft-above.
UPDATE public.products
SET
  pricing_type_below = COALESCE(pricing_type_below, 'per_unit'),
  pricing_type_above = COALESCE(pricing_type_above, 'per_sqft')
WHERE pricing_type = 'Multiple';
