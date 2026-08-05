-- Per-product threshold: measurement ≤ unit_price_max_sqft → unit price; above → sqft price.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_price_max_sqft numeric;

COMMENT ON COLUMN public.products.unit_price_max_sqft IS
  'For dual/Multiple pricing: use unit price when area ≤ this sqft; sqft price when above. Null = no auto switch (or treat as catalog-only).';
