-- Enable Supabase Realtime for order detail sync tables (idempotent).
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.site_visits;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.site_visit_measurements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.quotations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.designs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.productions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.installations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_activity;
exception when duplicate_object then null;
end $$;

-- Portal customer browser uses anon Supabase client for realtime on order detail.
-- Read-only SELECT mirrors existing quotations anon policies.
drop policy if exists "Portal anon read orders" on public.orders;
create policy "Portal anon read orders"
  on public.orders for select
  to anon
  using (true);

drop policy if exists "Portal anon read site_visits" on public.site_visits;
create policy "Portal anon read site_visits"
  on public.site_visits for select
  to anon
  using (true);

drop policy if exists "Portal anon read site_visit_measurements" on public.site_visit_measurements;
create policy "Portal anon read site_visit_measurements"
  on public.site_visit_measurements for select
  to anon
  using (true);

drop policy if exists "Portal anon read designs" on public.designs;
create policy "Portal anon read designs"
  on public.designs for select
  to anon
  using (true);

drop policy if exists "Portal anon read productions" on public.productions;
create policy "Portal anon read productions"
  on public.productions for select
  to anon
  using (true);

drop policy if exists "Portal anon read installations" on public.installations;
create policy "Portal anon read installations"
  on public.installations for select
  to anon
  using (true);

drop policy if exists "Portal anon read order_activity" on public.order_activity;
create policy "Portal anon read order_activity"
  on public.order_activity for select
  to anon
  using (true);
