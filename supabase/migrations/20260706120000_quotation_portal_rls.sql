-- Restrict anon portal access to customer-facing quotation rows only.
-- Internal statuses (Draft, Pending Approval) are visible to authenticated staff via company-scoped policies.

drop policy if exists "Enable read access for anon users" on public.quotations;
create policy "Anon read customer-visible quotations"
  on public.quotations for select
  to anon
  using (status in ('Sent', 'Approved', 'Rejected'));

-- Portal mutations go through server actions (service role + portal session validation).
drop policy if exists "Enable update access for anon users" on public.quotations;
