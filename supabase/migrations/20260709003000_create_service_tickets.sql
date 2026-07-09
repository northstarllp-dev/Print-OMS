-- Service tickets feature: queue + resolution workflow.

create table if not exists public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  ticket_id text,
  customer_id uuid not null references public.customers(id),
  order_id uuid not null references public.orders(id),
  phone text not null,
  description text not null,
  photos jsonb not null default '[]'::jsonb,
  resolution_notes text,
  resolution_photos jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'with_service_manager', 'closed')),
  source text not null default 'admin' check (source in ('admin', 'public_link')),
  created_by uuid references public.users(id),
  sent_to_service_manager_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_tickets_company_ticket_id_idx
  on public.service_tickets (company_id, ticket_id);

create index if not exists service_tickets_company_status_created_idx
  on public.service_tickets (company_id, status, created_at desc);

create index if not exists service_tickets_company_phone_idx
  on public.service_tickets (company_id, phone);

create or replace function public.generate_service_ticket_id()
returns trigger as $$
declare
  max_id integer;
begin
  if new.company_id is null then
    raise exception 'company_id is required to generate ticket_id';
  end if;

  if new.ticket_id is not null and new.ticket_id <> '' then
    return new;
  end if;

  select coalesce(
    max(nullif(regexp_replace(ticket_id, '\D', '', 'g'), '')::integer),
    0
  )
  into max_id
  from public.service_tickets
  where company_id = new.company_id
    and ticket_id is not null;

  new.ticket_id := 'TKT-' || lpad((max_id + 1)::text, 3, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists service_tickets_generate_ticket_id on public.service_tickets;
create trigger service_tickets_generate_ticket_id
before insert on public.service_tickets
for each row
execute function public.generate_service_ticket_id();

create or replace function public.set_service_tickets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists service_tickets_set_updated_at on public.service_tickets;
create trigger service_tickets_set_updated_at
before update on public.service_tickets
for each row
execute function public.set_service_tickets_updated_at();

alter table public.service_tickets enable row level security;

drop policy if exists "Company-scoped access for authenticated users" on public.service_tickets;
create policy "Company-scoped access for authenticated users"
  on public.service_tickets for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('service-ticket-photos', 'service-ticket-photos', true, 52428800, null),
  ('service-ticket-resolution-photos', 'service-ticket-resolution-photos', true, 52428800, null)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
