import { SupabaseClient } from "@supabase/supabase-js";
import { generateAndStorePortalToken } from "@/utils/portal-tokens";
import { WhatsAppTemplateKey } from "./templates";
import { isWhatsAppTestMode } from "./testMode";

export type NotificationContext = {
  companyId?: string;
  recipientPhone: string;
  bodyParameters: string[];
  portalToken: string;
  orderId?: string;
  enquiryId?: string;
};

export type BuildContextInput = {
  templateKey: WhatsAppTemplateKey;
  orderUuid?: string;
  orderFriendlyId?: string;
  enquiryId?: string;
  enquiryRow?: {
    id: string;
    enquire_id?: string;
    business_name?: string;
    lead_name?: string;
    whatsapp?: string;
    phone?: string;
    company_id?: string;
    customer_id?: string;
  };
  customerUuid?: string;
  customerFriendlyId?: string;
  companyName?: string;
  businessName?: string;
  date?: string;
  time?: string;
  ticketNo?: string;
  baseUrl?: string;
};

async function resolveCompanyName(
  supabase: SupabaseClient,
  companyId?: string
): Promise<string> {
  if (!companyId) return process.env.WHATSAPP_CLIENT_NAME || "Printec";
  const { data } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  return data?.name || process.env.WHATSAPP_CLIENT_NAME || "Printec";
}

async function loadOrderContext(
  supabase: SupabaseClient,
  orderUuid: string
): Promise<{
  order: Record<string, unknown>;
  customer: Record<string, unknown> | null;
  companyName: string;
}> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_id, company_id, customer_id, business_name, project_name")
    .eq("id", orderUuid)
    .single();
  if (error || !order) throw new Error("Order not found for notification");

  let customer: Record<string, unknown> | null = null;
  if (order.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("id, customer_id, name, business_name, whatsapp, phone")
      .eq("id", order.customer_id)
      .maybeSingle();
    customer = c;
  }

  const companyName = await resolveCompanyName(supabase, order.company_id as string);
  return { order, customer, companyName };
}

function pickPhone(
  customer: Record<string, unknown> | null,
  enquiry?: BuildContextInput["enquiryRow"]
): string | null {
  const w =
    (customer?.whatsapp as string) ||
    (customer?.phone as string) ||
    enquiry?.whatsapp ||
    enquiry?.phone ||
    null;
  return w || null;
}

function businessLabel(
  order: Record<string, unknown> | null,
  customer: Record<string, unknown> | null,
  enquiry?: BuildContextInput["enquiryRow"]
): string {
  return (
    (order?.business_name as string) ||
    (customer?.business_name as string) ||
    (customer?.name as string) ||
    enquiry?.business_name ||
    enquiry?.lead_name ||
    "Customer"
  );
}

export async function buildNotificationContext(
  supabase: SupabaseClient,
  input: BuildContextInput
): Promise<NotificationContext | null> {
  const baseUrl =
    input.baseUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WHATSAPP_PORTAL_URL_BASE?.replace(/\/portal\?token=$/, "") ||
    undefined;

  let companyId = input.enquiryRow?.company_id;
  let companyName = input.companyName;
  let order: Record<string, unknown> | null = null;
  let customer: Record<string, unknown> | null = null;
  let friendlyCustomerId = input.customerFriendlyId;
  let friendlyOrderId = input.orderFriendlyId;
  let businessName = input.businessName;

  if (input.orderUuid) {
    const ctx = await loadOrderContext(supabase, input.orderUuid);
    order = ctx.order;
    customer = ctx.customer;
    companyName = companyName || ctx.companyName;
    companyId = companyId || (order.company_id as string);
    friendlyOrderId = friendlyOrderId || (order.order_id as string);
    friendlyCustomerId =
      friendlyCustomerId || (customer?.customer_id as string) || undefined;
    businessName = businessName || businessLabel(order, customer, input.enquiryRow);
  } else if (input.customerUuid) {
    const { data: c } = await supabase
      .from("customers")
      .select("id, customer_id, name, business_name, whatsapp, phone, company_id")
      .eq("id", input.customerUuid)
      .maybeSingle();
    customer = c;
    friendlyCustomerId = friendlyCustomerId || (c?.customer_id as string);
    companyId = companyId || (c?.company_id as string);
    businessName = businessName || businessLabel(null, customer, input.enquiryRow);
    companyName = companyName || (await resolveCompanyName(supabase, companyId));
  } else if (input.enquiryRow) {
    companyId = input.enquiryRow.company_id;
    companyName = companyName || (await resolveCompanyName(supabase, companyId));
    businessName =
      businessName ||
      input.enquiryRow.business_name ||
      input.enquiryRow.lead_name ||
      "Customer";
  }

  const rawPhone = pickPhone(customer, input.enquiryRow);
  if (!rawPhone) return null;

  const testMode = isWhatsAppTestMode();

  if (!friendlyCustomerId && !testMode) return null;

  let portalToken = "";
  if (friendlyCustomerId) {
    try {
      const { token } = await generateAndStorePortalToken(
        supabase,
        friendlyCustomerId,
        friendlyOrderId,
        {
          expiresInDays: 30,
          createdBy: `whatsapp:${input.templateKey}`,
          baseUrl,
        }
      );
      portalToken = token;
    } catch (err) {
      console.error("[WhatsApp] portal token generation failed:", err);
      if (!testMode) return null;
    }
  }

  const clientName = companyName || "Printec";
  const bodyParameters: string[] = [];

  switch (input.templateKey) {
    case "enquiry_received":
      bodyParameters.push(
        businessName!,
        clientName,
        input.enquiryRow?.enquire_id || input.enquiryId || "—"
      );
      break;
    case "order_created":
      bodyParameters.push(businessName!, clientName, friendlyOrderId || "—");
      break;
    case "site_visit_scheduled":
    case "installation_scheduled":
      bodyParameters.push(businessName!, input.date || "—", input.time || "—");
      break;
    case "installation_completed":
    case "feedback_request":
      bodyParameters.push(businessName!, clientName);
      break;
    case "service_ticket_created":
      bodyParameters.push(businessName!, input.ticketNo || "—");
      break;
    default:
      bodyParameters.push(businessName!);
      break;
  }

  return {
    companyId,
    recipientPhone: rawPhone,
    bodyParameters,
    portalToken,
    orderId: friendlyOrderId,
    enquiryId: input.enquiryId || input.enquiryRow?.id,
  };
}
