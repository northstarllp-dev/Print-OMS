-- portal_access_tokens may be issued for a customer before any order exists
-- (e.g. enquiry_received WhatsApp). The previous company-scoped policy required
-- order_id to match an order, so inserts with order_id IS NULL always failed RLS.

drop policy if exists "Company-scoped access for authenticated users" on public.portal_access_tokens;
drop policy if exists "Allow authenticated read for portal tokens" on public.portal_access_tokens;
drop policy if exists "Allow authenticated insert for portal tokens" on public.portal_access_tokens;
drop policy if exists "Allow authenticated update for portal tokens" on public.portal_access_tokens;
drop policy if exists "Admin staff read access" on public.portal_access_tokens;

create policy "Company-scoped access for authenticated users"
  on public.portal_access_tokens for all
  to authenticated
  using (
    (
      order_id is not null
      and order_id in (
        select o.order_id
        from public.orders o
        where o.company_id = public.current_company_id()
      )
    )
    or (
      order_id is null
      and customer_id in (
        select c.customer_id
        from public.customers c
        where c.company_id = public.current_company_id()
      )
    )
  )
  with check (
    (
      order_id is not null
      and order_id in (
        select o.order_id
        from public.orders o
        where o.company_id = public.current_company_id()
      )
    )
    or (
      order_id is null
      and customer_id in (
        select c.customer_id
        from public.customers c
        where c.company_id = public.current_company_id()
      )
    )
  );
