-- Create app_settings table for per-company portal configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  site_visit_scheduling_enabled       boolean NOT NULL DEFAULT true,
  installation_scheduling_enabled     boolean NOT NULL DEFAULT true,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_app_settings_updated_at();

-- RLS: authenticated company members can read and write their own row
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- anon role (customer portal) can read settings (no auth.uid session available)
CREATE POLICY "Anon can read app_settings"
  ON public.app_settings FOR SELECT
  TO anon
  USING (true);
