-- Drop legacy global unique index on products.product_id.
-- Per-tenant uniqueness is enforced by products_company_product_id_key (company_id, product_id).

DROP INDEX IF EXISTS public.idx_products_product_id;
