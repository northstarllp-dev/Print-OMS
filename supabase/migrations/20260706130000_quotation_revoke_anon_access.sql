-- Remove all anonymous access to quotations.
-- Staff: company-scoped authenticated policies (20260704000011).
-- Portal: server-side service role after portal token / session validation.

drop policy if exists "Anon read customer-visible quotations" on public.quotations;
drop policy if exists "Enable read access for anon users" on public.quotations;
drop policy if exists "Enable update access for anon users" on public.quotations;
