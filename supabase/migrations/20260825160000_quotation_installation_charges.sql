-- Optional installation charges on quotations (added before shipping in quote totals).
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS installation_charges numeric DEFAULT 0;
