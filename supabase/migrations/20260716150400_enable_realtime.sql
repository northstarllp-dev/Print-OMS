DO $$
DECLARE
    t text;
    tables_to_add text[] := ARRAY['orders', 'site_visits', 'quotations', 'designs', 'productions', 'installations', 'order_activity', 'site_visit_measurements', 'payments'];
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY tables_to_add LOOP
        -- check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                AND tablename = t
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
            END IF;
        END IF;
    END LOOP;
END
$$;
