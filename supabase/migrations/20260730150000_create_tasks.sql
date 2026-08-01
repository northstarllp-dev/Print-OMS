-- Task Management module tables for internal employee tasks.

CREATE OR REPLACE FUNCTION public.generate_task_id() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate task_id';
    END IF;

    IF NEW.task_id IS NOT NULL AND NEW.task_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(task_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.tasks
    WHERE company_id = NEW.company_id;

    NEW.task_id := 'TSK-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id text,
    company_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    category text NOT NULL,
    task_type text NOT NULL,
    priority text NOT NULL DEFAULT 'Medium',
    status text NOT NULL DEFAULT 'Not Started',
    assignee_id uuid NOT NULL,
    created_by uuid NOT NULL,
    order_id uuid,
    assigned_at date NOT NULL DEFAULT CURRENT_DATE,
    due_date date,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT tasks_company_task_id_key UNIQUE (company_id, task_id),
    CONSTRAINT tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL,
    CONSTRAINT tasks_priority_check CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    CONSTRAINT tasks_status_check CHECK (status IN ('Not Started', 'In Progress', 'Waiting for Approval', 'Blocked', 'Completed', 'Cancelled')),
    CONSTRAINT tasks_category_check CHECK (category IN ('Order Related', 'Internal', 'Follow Up', 'Maintenance', 'Purchase', 'HR')),
    CONSTRAINT tasks_task_type_check CHECK (task_type IN ('Sales', 'Production', 'Inventory', 'Design', 'Installation', 'Accounts', 'Administration'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks USING btree (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_order_id ON public.tasks USING btree (order_id);

CREATE OR REPLACE TRIGGER tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_generate_task_id
    BEFORE INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.generate_task_id();

CREATE TABLE IF NOT EXISTS public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_comments_pkey PRIMARY KEY (id),
    CONSTRAINT task_comments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
    CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_task_comments_company_id ON public.task_comments USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments USING btree (task_id);

CREATE OR REPLACE TRIGGER task_comments_updated_at
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.tasks
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.task_comments
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;

ALTER publication supabase_realtime ADD TABLE public.tasks;
ALTER publication supabase_realtime ADD TABLE public.task_comments;

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;

GRANT ALL ON TABLE public.task_comments TO anon;
GRANT ALL ON TABLE public.task_comments TO authenticated;
GRANT ALL ON TABLE public.task_comments TO service_role;
