-- Staff worksheet: live sync of per-location data when Save Draft writes measurements.
-- Idempotent; applied on Printec-DB via MCP 2026-07-07.
do $$
begin
  alter publication supabase_realtime add table public.site_visit_measurements;
exception when duplicate_object then null;
end $$;
