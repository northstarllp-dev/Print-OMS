-- Which business operations a product can be used for (signage, flex_printing, …).
-- Empty / null = available for all operations (backward compatible).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS business_operations text[] DEFAULT '{}';

COMMENT ON COLUMN public.products.business_operations IS
  'Business operation ids this product applies to. Empty array means all operations.';
