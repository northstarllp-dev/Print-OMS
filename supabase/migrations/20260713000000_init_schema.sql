


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."current_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select company_id from public.users where id = auth.uid()
$$;


ALTER FUNCTION "public"."current_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_customer_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate customer_id';
    END IF;

    IF NEW.customer_id IS NOT NULL AND NEW.customer_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(customer_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.customers
    WHERE company_id = NEW.company_id;

    NEW.customer_id := 'A' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_customer_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_employee_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_employee_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_enquiry_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate enquire_id';
    END IF;

    IF NEW.enquire_id IS NOT NULL AND NEW.enquire_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(enquire_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.enquiries
    WHERE company_id = NEW.company_id;

    NEW.enquire_id := 'ENQ' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_enquiry_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    cust_id text;
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate order_id';
    END IF;

    IF NEW.order_id IS NOT NULL AND NEW.order_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT customer_id INTO cust_id
    FROM public.customers
    WHERE id = NEW.customer_id
      AND company_id = NEW.company_id;

    IF cust_id IS NULL THEN
        RAISE EXCEPTION 'customer not found for order (customer_id=%, company_id=%)', NEW.customer_id, NEW.company_id;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(order_id, '-', 2), '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.orders
    WHERE customer_id = NEW.customer_id
      AND company_id = NEW.company_id;

    NEW.order_id := cust_id || '-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_id_field"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  cust_id_text text;
  seq_num int;
BEGIN
  -- Get the customer's friendly customer_id (e.g. A001) using their UUID
  SELECT customer_id INTO cust_id_text FROM public.customers WHERE id = NEW.customer_id;
  
  -- If customer_id text is not found, fallback to 'A000'
  IF cust_id_text IS NULL THEN
    cust_id_text := 'A000';
  END IF;
  
  -- Find the next sequence number for this customer's orders
  SELECT COALESCE(MAX(SUBSTRING(order_id FROM '-([0-9]+)$')::integer), 0) + 1
  INTO seq_num
  FROM public.orders
  WHERE customer_id = NEW.customer_id;
  
  -- Construct order_id (e.g. A001-001)
  NEW.order_id := cust_id_text || '-' || lpad(seq_num::text, 3, '0');
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."generate_order_id_field"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_quotation_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate quotation_id';
    END IF;

    IF NEW.quotation_id IS NOT NULL AND NEW.quotation_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(quotation_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.quotations
    WHERE company_id = NEW.company_id;

    NEW.quotation_id := 'QT-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_quotation_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_service_ticket_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_service_ticket_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_app_user"("p_email" "text", "p_password" "text", "p_company_id" "uuid", "p_name" "text", "p_role" "text", "p_phone" "text", "p_staff_role" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.users (id, company_id, name, role, phone, email, staff_role)
  VALUES (v_user_id, p_company_id, p_name, p_role, p_phone, v_email, p_staff_role);

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."seed_app_user"("p_email" "text", "p_password" "text", "p_company_id" "uuid", "p_name" "text", "p_role" "text", "p_phone" "text", "p_staff_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_app_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_app_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_service_tickets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_service_tickets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_installations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_installations_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "site_visit_scheduling_enabled" boolean DEFAULT true NOT NULL,
    "installation_scheduling_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "whatsapp" "text" NOT NULL,
    "email" "text" NOT NULL,
    "city" "text",
    "billing_address" "text",
    "shipping_address" "text",
    "status" "text" DEFAULT 'Active'::"text",
    "customer_id" "text" NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."designs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "resources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."designs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."employee_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."employee_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "lead_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "whatsapp" "text" NOT NULL,
    "email" "text" NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text",
    "notes" "text",
    "primary_communication_mode" "text" DEFAULT 'MAIL'::"text",
    "location" "text",
    "date_received" timestamp with time zone DEFAULT "now"(),
    "enquire_id" "text" NOT NULL,
    "customer_id" "uuid",
    "order_id" "uuid",
    "added_by" "text",
    "business_name" "text"
);


ALTER TABLE "public"."enquiries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."enquiry_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."enquiry_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."installations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text",
    "assigned_team" "jsonb",
    "scheduled_date" "date",
    "scheduled_time" time without time zone,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customerSignature" "text",
    "paymentCode" "text",
    "gmapLink" "text",
    "gmapRequested" boolean DEFAULT false,
    "afterPhotos" "jsonb" DEFAULT '[]'::"jsonb",
    "scheduledDate" "text",
    "scheduledTime" "text",
    "photoUrl" "text"
);


ALTER TABLE "public"."installations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "template_key" "text" NOT NULL,
    "recipient_phone" "text" NOT NULL,
    "order_id" "text",
    "enquiry_id" "uuid",
    "body_parameters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "meta_message_id" "text",
    "error_message" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    CONSTRAINT "notification_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."notification_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "text" NOT NULL,
    "activity_type" "text" NOT NULL,
    "actor_name" "text" NOT NULL,
    "actor_role" "text" NOT NULL,
    "actor_id" "uuid",
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "is_read" boolean DEFAULT false,
    "edited" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "order_messages_tab_check" CHECK (("activity_type" = ANY (ARRAY['internal'::"text", 'customer'::"text", 'timeline'::"text"])))
);


ALTER TABLE "public"."order_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "stage_status" "text" DEFAULT 'Normal'::"text",
    "date_created" timestamp with time zone DEFAULT "now"(),
    "stage_admin_notes" "text",
    "business_name" "text",
    "order_id" "text" NOT NULL,
    "health" "text" DEFAULT 'Active'::"text",
    "lost_reason" "text",
    "product_type" "text",
    "requirements" "text",
    "design_details" "jsonb",
    "workflow_type" "text" DEFAULT 'quote_first'::"text" NOT NULL,
    "client_name" "text" DEFAULT ''::"text" NOT NULL,
    "assigned_admins" "uuid"[] DEFAULT '{}'::"uuid"[],
    CONSTRAINT "orders_workflow_type_check" CHECK (("workflow_type" = ANY (ARRAY['quote_first'::"text", 'design_first'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_name" "text" NOT NULL,
    "trigger_stage" "text" NOT NULL,
    "amount_type" "text" NOT NULL,
    "amount" numeric,
    "percentage" numeric,
    "calculated_amount" numeric,
    "status" "text" DEFAULT 'expected'::"text" NOT NULL,
    "notes" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_type_check" CHECK (("amount_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['expected'::"text", 'received'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "jti" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "order_id" "text",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_by" "text" DEFAULT 'system'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."portal_access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "procurementOfMaterials" boolean DEFAULT false,
    "acpAndAcrylicCutting" boolean DEFAULT false,
    "lightingAndWiring" boolean DEFAULT false,
    "qualityCheck" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deadline" timestamp with time zone
);


ALTER TABLE "public"."productions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text" NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "pricing_type" "text" DEFAULT 'per_unit'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price_per_sqft" numeric,
    "price_per_unit" numeric,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "final_prdt" boolean DEFAULT false
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "text" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "customer_id" "uuid",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "discount" numeric DEFAULT 0 NOT NULL,
    "tax" numeric DEFAULT 0 NOT NULL,
    "grand_total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "signage_options" "jsonb" DEFAULT '[]'::"jsonb",
    "admin_approved_at" timestamp with time zone,
    "admin_approved_by" "text",
    "follow_up_sent_at" timestamp with time zone,
    "customer_response" "text",
    "shipping" numeric DEFAULT 0,
    "rejection_reason" "text"
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "ticket_id" "text",
    "customer_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "description" "text" NOT NULL,
    "photos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "resolution_notes" "text",
    "resolution_photos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "source" "text" DEFAULT 'admin'::"text" NOT NULL,
    "created_by" "uuid",
    "sent_to_service_manager_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_tickets_source_check" CHECK (("source" = ANY (ARRAY['admin'::"text", 'public_link'::"text"]))),
    CONSTRAINT "service_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'with_service_manager'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."service_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visit_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_visit_id" "uuid",
    "name" "text" NOT NULL,
    "width" numeric,
    "height" numeric,
    "depth" numeric,
    "ground_clearance" numeric,
    "notes" "text",
    "photos" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "power_available" boolean DEFAULT false,
    "distance_to_power_source" numeric,
    "distance_to_power_source_unit" "text",
    "electrical_notes" "text",
    "wall_type" "text",
    "mounting_method" "text",
    "surface_condition" "text",
    "obstacles" "jsonb",
    "structural_notes" "text",
    "width_unit" "text" DEFAULT 'ft'::"text",
    "height_unit" "text" DEFAULT 'ft'::"text",
    "depth_unit" "text" DEFAULT 'ft'::"text",
    "ground_clearance_unit" "text" DEFAULT 'ft'::"text"
);


ALTER TABLE "public"."site_visit_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "company_id" "uuid",
    "customer_address" "text",
    "landmark" "text",
    "preferred_date" "text",
    "preferred_time" "text",
    "gps_location" "text",
    "audit_date" "text",
    "audit_time" "text",
    "internal_notes" "jsonb",
    "review_status" "text",
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "scaffolding_required" boolean DEFAULT false,
    "crane_required" boolean DEFAULT false,
    "overnight_installation" boolean DEFAULT false,
    "extra_angles_required" boolean DEFAULT false,
    "extra_angles_length" "text",
    "extra_acp_sheet_required" boolean DEFAULT false,
    "old_board_removal_required" boolean DEFAULT false,
    "extra_wire_required" boolean DEFAULT false,
    "design_brief_available" "text",
    "fabrication_required" boolean DEFAULT false,
    "civil_work_required" boolean DEFAULT false
);


ALTER TABLE "public"."site_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "staff_role" "text",
    "employee_id" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_company_id_key" UNIQUE ("company_id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_customer_id_key" UNIQUE ("company_id", "customer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_order_id_unique" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_company_enquire_id_key" UNIQUE ("company_id", "enquire_id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."installations"
    ADD CONSTRAINT "installations_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."installations"
    ADD CONSTRAINT "installations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_assignments"
    ADD CONSTRAINT "order_assignments_order_id_employee_id_key" UNIQUE ("order_id", "employee_id");



ALTER TABLE ONLY "public"."order_assignments"
    ADD CONSTRAINT "order_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_files"
    ADD CONSTRAINT "order_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_activity"
    ADD CONSTRAINT "order_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_company_order_id_key" UNIQUE ("company_id", "order_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_access_tokens"
    ADD CONSTRAINT "portal_access_tokens_jti_key" UNIQUE ("jti");



ALTER TABLE ONLY "public"."portal_access_tokens"
    ADD CONSTRAINT "portal_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_name_company_key" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productions"
    ADD CONSTRAINT "productions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_product_id_key" UNIQUE ("company_id", "product_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_company_quotation_id_key" UNIQUE ("company_id", "quotation_id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_tickets"
    ADD CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_visit_measurements"
    ADD CONSTRAINT "site_visit_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "designs_order_id_idx" ON "public"."designs" USING "btree" ("order_id");



CREATE INDEX "idx_customers_company" ON "public"."customers" USING "btree" ("company_id");



CREATE INDEX "idx_enquiries_company" ON "public"."enquiries" USING "btree" ("company_id");



CREATE INDEX "idx_order_activity_lookup" ON "public"."order_activity" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_order_activity_type" ON "public"."order_activity" USING "btree" ("activity_type");



CREATE INDEX "idx_orders_company" ON "public"."orders" USING "btree" ("company_id");



CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_portal_tokens_customer" ON "public"."portal_access_tokens" USING "btree" ("customer_id");



CREATE INDEX "idx_portal_tokens_jti" ON "public"."portal_access_tokens" USING "btree" ("jti");



CREATE INDEX "idx_portal_tokens_order" ON "public"."portal_access_tokens" USING "btree" ("order_id");



CREATE INDEX "idx_portal_tokens_revoked" ON "public"."portal_access_tokens" USING "btree" ("revoked_at");



CREATE INDEX "idx_product_categories_company" ON "public"."product_categories" USING "btree" ("company_id");



CREATE INDEX "idx_products_company" ON "public"."products" USING "btree" ("company_id");



CREATE INDEX "idx_quotations_customer_id" ON "public"."quotations" USING "btree" ("customer_id");



CREATE INDEX "idx_quotations_order_id" ON "public"."quotations" USING "btree" ("order_id");



CREATE INDEX "notification_outbox_created_idx" ON "public"."notification_outbox" USING "btree" ("created_at" DESC);



CREATE INDEX "notification_outbox_order_idx" ON "public"."notification_outbox" USING "btree" ("order_id");



CREATE INDEX "notification_outbox_status_idx" ON "public"."notification_outbox" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "payments_trigger_stage_idx" ON "public"."payments" USING "btree" ("trigger_stage");



CREATE UNIQUE INDEX "productions_order_id_key" ON "public"."productions" USING "btree" ("order_id");



CREATE INDEX "service_tickets_company_phone_idx" ON "public"."service_tickets" USING "btree" ("company_id", "phone");



CREATE INDEX "service_tickets_company_status_created_idx" ON "public"."service_tickets" USING "btree" ("company_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "service_tickets_company_ticket_id_idx" ON "public"."service_tickets" USING "btree" ("company_id", "ticket_id");



CREATE INDEX "site_visit_measurements_site_visit_id_idx" ON "public"."site_visit_measurements" USING "btree" ("site_visit_id");



CREATE OR REPLACE TRIGGER "designs_set_updated_at" BEFORE UPDATE ON "public"."designs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "installations_updated_at" BEFORE UPDATE ON "public"."installations" FOR EACH ROW EXECUTE FUNCTION "public"."update_installations_updated_at"();



CREATE OR REPLACE TRIGGER "payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "quotations_updated_at" BEFORE UPDATE ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "service_tickets_generate_ticket_id" BEFORE INSERT ON "public"."service_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."generate_service_ticket_id"();



CREATE OR REPLACE TRIGGER "service_tickets_set_updated_at" BEFORE UPDATE ON "public"."service_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_service_tickets_updated_at"();



CREATE OR REPLACE TRIGGER "trg_app_settings_updated_at" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_app_settings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_generate_employee_id" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."generate_employee_id"();



CREATE OR REPLACE TRIGGER "trigger_generate_customer_id" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."generate_customer_id"();



CREATE OR REPLACE TRIGGER "trigger_generate_enquiry_id" BEFORE INSERT ON "public"."enquiries" FOR EACH ROW EXECUTE FUNCTION "public"."generate_enquiry_id"();



CREATE OR REPLACE TRIGGER "trigger_generate_order_id" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_order_id"();



CREATE OR REPLACE TRIGGER "trigger_generate_order_id_field" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."generate_order_id_field"();



CREATE OR REPLACE TRIGGER "trigger_generate_quotation_id" BEFORE INSERT ON "public"."quotations" FOR EACH ROW EXECUTE FUNCTION "public"."generate_quotation_id"();



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."designs"
    ADD CONSTRAINT "designs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."enquiries"
    ADD CONSTRAINT "enquiries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."installations"
    ADD CONSTRAINT "installations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_assignments"
    ADD CONSTRAINT "order_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_assignments"
    ADD CONSTRAINT "order_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_activity"
    ADD CONSTRAINT "order_messages_sender_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productions"
    ADD CONSTRAINT "productions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_tickets"
    ADD CONSTRAINT "service_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."service_tickets"
    ADD CONSTRAINT "service_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."service_tickets"
    ADD CONSTRAINT "service_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."service_tickets"
    ADD CONSTRAINT "service_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."site_visit_measurements"
    ADD CONSTRAINT "site_visit_measurements_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_visits"
    ADD CONSTRAINT "site_visits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



CREATE POLICY "Allow insert access to anon users on order_files" ON "public"."order_files" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow read access to anon users on order_files" ON "public"."order_files" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can read app_settings" ON "public"."app_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."app_settings" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."customers" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."designs" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."enquiries" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."installations" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."notification_outbox" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."order_activity" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."order_id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."order_id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."order_assignments" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."order_files" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."order_id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."order_id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."orders" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."payments" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."portal_access_tokens" TO "authenticated" USING (((("order_id" IS NOT NULL) AND ("order_id" IN ( SELECT "o"."order_id"
   FROM "public"."orders" "o"
  WHERE ("o"."company_id" = "public"."current_company_id"())))) OR (("order_id" IS NULL) AND ("customer_id" IN ( SELECT "c"."customer_id"
   FROM "public"."customers" "c"
  WHERE ("c"."company_id" = "public"."current_company_id"())))))) WITH CHECK (((("order_id" IS NOT NULL) AND ("order_id" IN ( SELECT "o"."order_id"
   FROM "public"."orders" "o"
  WHERE ("o"."company_id" = "public"."current_company_id"())))) OR (("order_id" IS NULL) AND ("customer_id" IN ( SELECT "c"."customer_id"
   FROM "public"."customers" "c"
  WHERE ("c"."company_id" = "public"."current_company_id"()))))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."product_categories" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."productions" TO "authenticated" USING (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"())))) WITH CHECK (("order_id" IN ( SELECT "orders"."id"
   FROM "public"."orders"
  WHERE ("orders"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."products" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."quotations" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."service_tickets" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."site_visit_measurements" TO "authenticated" USING (("site_visit_id" IN ( SELECT "site_visits"."id"
   FROM "public"."site_visits"
  WHERE ("site_visits"."company_id" = "public"."current_company_id"())))) WITH CHECK (("site_visit_id" IN ( SELECT "site_visits"."id"
   FROM "public"."site_visits"
  WHERE ("site_visits"."company_id" = "public"."current_company_id"()))));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."site_visits" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped access for authenticated users" ON "public"."users" TO "authenticated" USING (("company_id" = "public"."current_company_id"())) WITH CHECK (("company_id" = "public"."current_company_id"()));



CREATE POLICY "Company-scoped read for authenticated users" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" = "public"."current_company_id"()));



CREATE POLICY "Enable read access for anon users" ON "public"."customers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for anon users" ON "public"."enquiries" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for anon users on payments" ON "public"."payments" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."designs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."installations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visit_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."designs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."installations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_activity";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_files";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."productions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."quotations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."site_visit_measurements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."site_visits";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."current_company_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_company_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_company_id"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."generate_customer_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_customer_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_customer_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_employee_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_employee_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_employee_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_enquiry_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_enquiry_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_enquiry_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_id_field"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_id_field"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_id_field"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_quotation_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_quotation_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_quotation_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_service_ticket_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_service_ticket_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_service_ticket_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_app_user"("p_email" "text", "p_password" "text", "p_company_id" "uuid", "p_name" "text", "p_role" "text", "p_phone" "text", "p_staff_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_app_user"("p_email" "text", "p_password" "text", "p_company_id" "uuid", "p_name" "text", "p_role" "text", "p_phone" "text", "p_staff_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_app_user"("p_email" "text", "p_password" "text", "p_company_id" "uuid", "p_name" "text", "p_role" "text", "p_phone" "text", "p_staff_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_app_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_app_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_app_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_service_tickets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_service_tickets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_service_tickets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_installations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_installations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_installations_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."designs" TO "anon";
GRANT ALL ON TABLE "public"."designs" TO "authenticated";
GRANT ALL ON TABLE "public"."designs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."employee_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."employee_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."employee_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."enquiries" TO "anon";
GRANT ALL ON TABLE "public"."enquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."enquiries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."enquiry_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."enquiry_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."enquiry_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."installations" TO "anon";
GRANT ALL ON TABLE "public"."installations" TO "authenticated";
GRANT ALL ON TABLE "public"."installations" TO "service_role";



GRANT ALL ON TABLE "public"."notification_outbox" TO "anon";
GRANT ALL ON TABLE "public"."notification_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."order_activity" TO "anon";
GRANT ALL ON TABLE "public"."order_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."order_activity" TO "service_role";



GRANT ALL ON TABLE "public"."order_assignments" TO "anon";
GRANT ALL ON TABLE "public"."order_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."order_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."order_files" TO "anon";
GRANT ALL ON TABLE "public"."order_files" TO "authenticated";
GRANT ALL ON TABLE "public"."order_files" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."portal_access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."portal_access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."productions" TO "anon";
GRANT ALL ON TABLE "public"."productions" TO "authenticated";
GRANT ALL ON TABLE "public"."productions" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."service_tickets" TO "anon";
GRANT ALL ON TABLE "public"."service_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."service_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."site_visit_measurements" TO "anon";
GRANT ALL ON TABLE "public"."site_visit_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visit_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."site_visits" TO "anon";
GRANT ALL ON TABLE "public"."site_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visits" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































