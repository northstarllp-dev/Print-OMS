-- Invoices module: tax invoices auto-created from approved quotations.

CREATE OR REPLACE FUNCTION "public"."generate_invoice_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate invoice_id';
    END IF;

    IF NEW.invoice_id IS NOT NULL AND NEW.invoice_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.invoices
    WHERE company_id = NEW.company_id;

    NEW.invoice_id := 'INV-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."generate_invoice_id"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "text",
    "order_id" "uuid" NOT NULL,
    "quotation_row_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "discount" numeric DEFAULT 0 NOT NULL,
    "tax" numeric DEFAULT 0 NOT NULL,
    "shipping" numeric DEFAULT 0 NOT NULL,
    "grand_total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "signage_options" "jsonb" DEFAULT '[]'::"jsonb",
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoices_order_id_key" UNIQUE ("order_id"),
    CONSTRAINT "invoices_company_invoice_id_key" UNIQUE ("company_id", "invoice_id"),
    CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
    CONSTRAINT "invoices_quotation_row_id_fkey" FOREIGN KEY ("quotation_row_id") REFERENCES "public"."quotations"("id") ON DELETE SET NULL,
    CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id"),
    CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
);

ALTER TABLE "public"."invoices" OWNER TO "postgres";

CREATE INDEX "idx_invoices_customer_id" ON "public"."invoices" USING "btree" ("customer_id");
CREATE INDEX "idx_invoices_company_id" ON "public"."invoices" USING "btree" ("company_id");
CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");

CREATE OR REPLACE TRIGGER "invoices_updated_at"
    BEFORE UPDATE ON "public"."invoices"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trigger_generate_invoice_id"
    BEFORE INSERT ON "public"."invoices"
    FOR EACH ROW EXECUTE FUNCTION "public"."generate_invoice_id"();

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON "public"."invoices"
    TO "authenticated"
    USING (("company_id" = "public"."current_company_id"()))
    WITH CHECK (("company_id" = "public"."current_company_id"()));

ALTER TABLE "public"."invoices" REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON FUNCTION "public"."generate_invoice_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_id"() TO "service_role";

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";
