-- On Hold follow-up fields + standalone calendar reminders

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hold_note text,
  ADD COLUMN IF NOT EXISTS reach_out_at date;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS hold_note text,
  ADD COLUMN IF NOT EXISTS reach_out_at date;

CREATE TABLE IF NOT EXISTS public.calendar_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  reminder_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  viewer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_company_date
  ON public.calendar_reminders USING btree (company_id, reminder_date);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_created_by
  ON public.calendar_reminders USING btree (created_by);

CREATE INDEX IF NOT EXISTS idx_orders_reach_out_at
  ON public.orders USING btree (company_id, reach_out_at)
  WHERE reach_out_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_reach_out_at
  ON public.enquiries USING btree (company_id, reach_out_at)
  WHERE reach_out_at IS NOT NULL;

CREATE OR REPLACE TRIGGER calendar_reminders_updated_at
  BEFORE UPDATE ON public.calendar_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
  ON public.calendar_reminders
  FOR ALL
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

GRANT ALL ON TABLE public.calendar_reminders TO anon;
GRANT ALL ON TABLE public.calendar_reminders TO authenticated;
GRANT ALL ON TABLE public.calendar_reminders TO service_role;
