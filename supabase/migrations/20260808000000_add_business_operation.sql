-- Business operation id (signage, flex_printing, …) chosen at enquiry time.
-- Valid values come from per-client config; no CHECK constraint.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS business_operation text NOT NULL DEFAULT 'signage';

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS business_operation text DEFAULT 'signage';

COMMENT ON COLUMN public.orders.business_operation IS
  'Business operation id from client config (e.g. signage, flex_printing). Drives which pipeline stages apply.';

COMMENT ON COLUMN public.enquiries.business_operation IS
  'Business operation chosen when the enquiry was created; copied to orders on convert.';
