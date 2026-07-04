-- Phase 5: Tenant isolation.
-- Replaces blanket `USING (true)` policies for the `authenticated` role with
-- company_id-scoped policies. Anon-role policies (customer portal, token-based,
-- no auth.uid() session) are left untouched — they must stay permissive since
-- there is no authenticated session to scope against.
--
-- current_company_id() is SECURITY DEFINER so it can read public.users without
-- being blocked by the very RLS policy we're about to apply to that table.

create or replace function public.current_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.users where id = auth.uid()
$$;

-- RLS policies call this in the querying session's context, so `authenticated`
-- must retain EXECUTE or every scoped query fails with "permission denied".
-- Not meant to be called directly from the client, so anon/public are revoked.
revoke all on function public.current_company_id() from public, anon;
grant execute on function public.current_company_id() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables with a direct company_id column
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "Enable read access for all authenticated users" on public.companies;
create policy "Company-scoped read for authenticated users"
  on public.companies for select
  to authenticated
  using (id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.users;
create policy "Company-scoped access for authenticated users"
  on public.users for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.customers;
create policy "Company-scoped access for authenticated users"
  on public.customers for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.enquiries;
create policy "Company-scoped access for authenticated users"
  on public.enquiries for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.orders;
create policy "Company-scoped access for authenticated users"
  on public.orders for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.products;
create policy "Company-scoped access for authenticated users"
  on public.products for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.product_categories;
create policy "Company-scoped access for authenticated users"
  on public.product_categories for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Staff can insert notification outbox" on public.notification_outbox;
drop policy if exists "Staff can read notification outbox" on public.notification_outbox;
drop policy if exists "Staff can update notification outbox" on public.notification_outbox;
create policy "Company-scoped access for authenticated users"
  on public.notification_outbox for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "Enable all access for authenticated users" on public.site_visits;
create policy "Company-scoped access for authenticated users"
  on public.site_visits for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- quotations: the two "anon" policies were actually granted to role `public`
-- (which includes `authenticated`), silently bypassing tenant scoping for any
-- logged-in user. Narrow them to `anon` only — identical behavior for the
-- unauthenticated customer portal, but authenticated access now goes through
-- the scoped ALL policy below.
drop policy if exists "Enable read access for anon users" on public.quotations;
create policy "Enable read access for anon users"
  on public.quotations for select
  to anon
  using (true);

drop policy if exists "Enable update access for anon users" on public.quotations;
create policy "Enable update access for anon users"
  on public.quotations for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Enable all access for authenticated users" on public.quotations;
create policy "Company-scoped access for authenticated users"
  on public.quotations for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ─────────────────────────────────────────────────────────────────────────
-- Tables without company_id — scoped via their parent order's company_id
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "Enable all access for authenticated users" on public.designs;
create policy "Company-scoped access for authenticated users"
  on public.designs for all
  to authenticated
  using (order_id in (select id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select id from public.orders where company_id = public.current_company_id()));

-- installations previously had 4 overlapping authenticated policies (the ALL
-- policy alone already covered insert/select/update — permissive policies OR
-- together, so all 4 must be dropped or the old `true` ones keep full access).
drop policy if exists "Allow authenticated insert access" on public.installations;
drop policy if exists "Allow authenticated read access" on public.installations;
drop policy if exists "Allow authenticated update access" on public.installations;
drop policy if exists "Enable all access for authenticated users" on public.installations;
create policy "Company-scoped access for authenticated users"
  on public.installations for all
  to authenticated
  using (order_id in (select id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select id from public.orders where company_id = public.current_company_id()));

drop policy if exists "Enable all access for authenticated users" on public.productions;
create policy "Company-scoped access for authenticated users"
  on public.productions for all
  to authenticated
  using (order_id in (select id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select id from public.orders where company_id = public.current_company_id()));

-- order_activity.order_id is the text business id (orders.order_id), not orders.id
drop policy if exists "Allow all access to authenticated users on order_messages" on public.order_activity;
create policy "Company-scoped access for authenticated users"
  on public.order_activity for all
  to authenticated
  using (order_id in (select order_id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select order_id from public.orders where company_id = public.current_company_id()));

-- order_assignments was previously granted to role `public` (includes anon) —
-- narrowing to `authenticated` closes an unintended anon-access gap; nothing
-- in the customer portal reads this table.
drop policy if exists "Allow all for authenticated" on public.order_assignments;
create policy "Company-scoped access for authenticated users"
  on public.order_assignments for all
  to authenticated
  using (order_id in (select id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select id from public.orders where company_id = public.current_company_id()));

-- order_files.order_id is the text business id (orders.order_id), not orders.id
drop policy if exists "Allow all access to authenticated users on order_files" on public.order_files;
create policy "Company-scoped access for authenticated users"
  on public.order_files for all
  to authenticated
  using (order_id in (select order_id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select order_id from public.orders where company_id = public.current_company_id()));

drop policy if exists "Enable all access for authenticated users" on public.payments;
create policy "Company-scoped access for authenticated users"
  on public.payments for all
  to authenticated
  using (order_id in (select id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select id from public.orders where company_id = public.current_company_id()));

-- portal_access_tokens.order_id is the text business id (orders.order_id), not orders.id
drop policy if exists "Admin staff read access" on public.portal_access_tokens;
create policy "Company-scoped access for authenticated users"
  on public.portal_access_tokens for all
  to authenticated
  using (order_id in (select order_id from public.orders where company_id = public.current_company_id()))
  with check (order_id in (select order_id from public.orders where company_id = public.current_company_id()));

-- site_visit_measurements has no order_id — joins via site_visits, which has
-- its own company_id column.
drop policy if exists "Enable all access for authenticated users" on public.site_visit_measurements;
create policy "Company-scoped access for authenticated users"
  on public.site_visit_measurements for all
  to authenticated
  using (site_visit_id in (select id from public.site_visits where company_id = public.current_company_id()))
  with check (site_visit_id in (select id from public.site_visits where company_id = public.current_company_id()));
