-- Per-company letterhead / bank / GSTIN for quotation documents (multi-tenant).
-- Quotation table columns are unchanged; this only extends app_settings.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS invoice_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.invoice_profile IS
  'Company invoice/quotation letterhead: legalName, brandName, address, gstin, email, website, logoUrl, placeOfSupplyDefault, taxSplit, bank, defaultTerms';
