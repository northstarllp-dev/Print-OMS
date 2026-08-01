-- Track admin shares of customer message templates (copy / WhatsApp / email).

CREATE TABLE IF NOT EXISTS public.customer_message_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    order_id text NOT NULL,
    template_key text NOT NULL,
    channel text NOT NULL,
    shared_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_message_shares_pkey PRIMARY KEY (id),
    CONSTRAINT customer_message_shares_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT customer_message_shares_channel_check
        CHECK (channel IN ('copy', 'whatsapp', 'email')),
    CONSTRAINT customer_message_shares_unique
        UNIQUE (company_id, order_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_message_shares_order
    ON public.customer_message_shares USING btree (company_id, order_id);

ALTER TABLE public.customer_message_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.customer_message_shares
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

GRANT ALL ON TABLE public.customer_message_shares TO anon;
GRANT ALL ON TABLE public.customer_message_shares TO authenticated;
GRANT ALL ON TABLE public.customer_message_shares TO service_role;
