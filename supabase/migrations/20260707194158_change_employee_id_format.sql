CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.role = 'staff' AND (NEW.employee_id IS NULL OR NEW.employee_id = '') THEN
        IF NEW.company_id IS NULL THEN
            RAISE EXCEPTION 'company_id is required to generate employee_id';
        END IF;

        SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_id, '\D', '', 'g'), '')::integer), 0)
        INTO max_id
        FROM public.users
        WHERE company_id = NEW.company_id AND role = 'staff';

        NEW.employee_id := 'E' || LPAD((max_id + 1)::text, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
    r RECORD;
    curr_max integer;
    curr_company uuid := NULL;
BEGIN
    FOR r IN SELECT id, company_id FROM public.users WHERE role = 'staff' ORDER BY company_id, id ASC LOOP
        IF curr_company IS DISTINCT FROM r.company_id THEN
            curr_company := r.company_id;
            curr_max := 1;
        ELSE
            curr_max := curr_max + 1;
        END IF;
        
        UPDATE public.users 
        SET employee_id = 'E' || LPAD(curr_max::text, 3, '0') 
        WHERE id = r.id;
    END LOOP;
END $$;
