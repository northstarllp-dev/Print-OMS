-- Ensure DELETE events can be filtered on non-PK columns (e.g. site_visit_id, order_id).
-- With the default REPLICA IDENTITY, Realtime only sees the primary key in old records,
-- so filters like site_visit_id=eq.<uuid> silently drop DELETE payloads.
-- FULL also supplies old.* for UPDATE/DELETE handlers that need more than the PK.
-- With RLS enabled, clients may still only receive PK columns in the DELETE payload;
-- server-side filtering still uses the full WAL row when identity is FULL.

ALTER TABLE public.site_visit_measurements REPLICA IDENTITY FULL;
ALTER TABLE public.site_visits REPLICA IDENTITY FULL;
ALTER TABLE public.designs REPLICA IDENTITY FULL;
ALTER TABLE public.productions REPLICA IDENTITY FULL;
ALTER TABLE public.installations REPLICA IDENTITY FULL;
ALTER TABLE public.order_activity REPLICA IDENTITY FULL;
ALTER TABLE public.quotations REPLICA IDENTITY FULL;
ALTER TABLE public.order_files REPLICA IDENTITY FULL;
