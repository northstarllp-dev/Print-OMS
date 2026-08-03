-- Fix sales-income sync: durable idempotency key for synced finance rows.

ALTER TABLE public.finance_entries
    ADD COLUMN IF NOT EXISTS source_ref text;

-- Backfill source_ref from notes tags where present (before unique index).
UPDATE public.finance_entries
SET source_ref = substring(notes from 'order_payment:[0-9a-f-]{36}')
WHERE entry_type = 'receipt'
  AND source_ref IS NULL
  AND notes ~ 'order_payment:[0-9a-f-]{36}';

UPDATE public.finance_entries
SET source_ref = substring(notes from 'po_payment:[0-9a-f-]{36}')
WHERE entry_type = 'payment'
  AND source_ref IS NULL
  AND notes ~ 'po_payment:[0-9a-f-]{36}';

-- Drop duplicate synced receipts (keep earliest per source_ref).
DELETE FROM public.finance_entries fe
WHERE fe.entry_type = 'receipt'
  AND fe.source_ref IS NOT NULL
  AND fe.id NOT IN (
    SELECT DISTINCT ON (company_id, source_ref) id
    FROM public.finance_entries
    WHERE entry_type = 'receipt'
      AND source_ref IS NOT NULL
    ORDER BY company_id, source_ref, created_at ASC
  );

-- Drop duplicate synced PO payments (keep earliest per source_ref).
DELETE FROM public.finance_entries fe
WHERE fe.entry_type = 'payment'
  AND fe.source_ref IS NOT NULL
  AND fe.id NOT IN (
    SELECT DISTINCT ON (company_id, source_ref) id
    FROM public.finance_entries
    WHERE entry_type = 'payment'
      AND source_ref IS NOT NULL
    ORDER BY company_id, source_ref, created_at ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_company_source_ref_key
    ON public.finance_entries (company_id, source_ref)
    WHERE source_ref IS NOT NULL;
