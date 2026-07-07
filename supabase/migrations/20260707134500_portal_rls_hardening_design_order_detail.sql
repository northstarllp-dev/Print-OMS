-- Portal RLS hardening for design/order detail surfaces.
-- We remove broad anon table policies and route portal access through
-- token-validated server endpoints using privileged server-side clients.

-- orders
drop policy if exists "Portal anon read orders" on public.orders;
drop policy if exists "Enable read access for anon users" on public.orders;
drop policy if exists "Enable update access for anon users" on public.orders;

-- site_visits
drop policy if exists "Portal anon read site_visits" on public.site_visits;
drop policy if exists "Enable read access for anon users" on public.site_visits;
drop policy if exists "Enable insert access for anon users" on public.site_visits;
drop policy if exists "Enable update access for anon users" on public.site_visits;

-- site_visit_measurements
drop policy if exists "Portal anon read site_visit_measurements" on public.site_visit_measurements;

-- designs
drop policy if exists "Portal anon read designs" on public.designs;

-- productions
drop policy if exists "Portal anon read productions" on public.productions;

-- installations
drop policy if exists "Portal anon read installations" on public.installations;

-- order_activity
drop policy if exists "Portal anon read order_activity" on public.order_activity;
drop policy if exists "Allow read access to anon users on customer and timeline tabs" on public.order_activity;
drop policy if exists "Allow insert access to anon users on customer tab" on public.order_activity;
