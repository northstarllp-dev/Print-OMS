"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import { assertStageEditPermission } from "@/features/orders/workspace/shared/serverPermissions";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/** Generate next QT-NNN id scoped to the tenant's existing quotations. */
async function generateQuotationId(supabase: Awaited<ReturnType<typeof getSupabase>>, companyId: string): Promise<string> {
  const { data } = await supabase
    .from("quotations")
    .select("quotation_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  let maxNum = 0;
  for (const row of data || []) {
    const match = row.quotation_id?.match(/^QT-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `QT-${String(maxNum + 1).padStart(3, "0")}`;
}

/** Resolve a friendly order_id or uuid → actual DB uuid */
async function resolveOrderId(supabase: any, orderId: string): Promise<{ uuid: string; friendly: string; customerId?: string; customerName?: string; companyId?: string }> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(orderId)) {
    const { data: o } = await supabase.from("orders").select("id, order_id, customer_id, business_name, company_id").eq("order_id", orderId).maybeSingle();
    if (o) return { uuid: o.id, friendly: o.order_id || o.id, customerId: o.customer_id, customerName: o.business_name, companyId: o.company_id };
    return { uuid: orderId, friendly: orderId };
  } else {
    const { data: o } = await supabase.from("orders").select("order_id, customer_id, business_name, company_id").eq("id", orderId).maybeSingle();
    return { uuid: orderId, friendly: o?.order_id || orderId, customerId: o?.customer_id, customerName: o?.business_name, companyId: o?.company_id };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getQuotationByOrderId(orderId: string) {
  const supabase = await getSupabase();
  const { uuid } = await resolveOrderId(supabase, orderId);
  const { data, error } = await supabase.from("quotations").select("*").eq("order_id", uuid).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllQuotations() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("quotations").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}



/** Get site visit measurements for an order (signage items), mapped to UI camelCase with units. */
export async function getSiteVisitMeasurementsForOrder(orderId: string) {
  const supabase = await getSupabase();
  const { uuid } = await resolveOrderId(supabase, orderId);
  // Find the site visit for this order
  const { data: sv } = await supabase.from("site_visits").select("id").eq("order_id", uuid).maybeSingle();
  if (!sv) return [];
  const { data, error } = await supabase
    .from("site_visit_measurements")
    .select("id, name, width, width_unit, height, height_unit, depth, depth_unit, notes, ground_clearance, ground_clearance_unit")
    .eq("site_visit_id", sv.id)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data || []).map(mapSiteVisitMeasurementFromDb);
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Quotation Core
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotationPayload {
  quotation_id?: string;
  items?: any[];
  signage_options?: any[];   // new multi-option structure
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  status?: string;
  notes?: string;
  terms?: string;
  customer_id?: string;

  shipping?: number;
}

/** Upsert quotation — creates if not exists, updates if already there */
export async function upsertQuotation(orderId: string, payload: QuotationPayload) {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const resolved = await resolveOrderId(supabase, orderId);

  if (!payload.customer_id) payload.customer_id = resolved.customerId;

  const { data: existing } = await supabase.from("quotations").select("id, quotation_id").eq("order_id", resolved.uuid).maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabase.from("quotations")
      .update({
        quotation_id: payload.quotation_id || existing.quotation_id,
        signage_options: payload.signage_options ?? [],
        subtotal: payload.subtotal,
        discount: payload.discount,
        tax: payload.tax,
        grand_total: payload.grand_total,
        status: payload.status || "Draft",
        notes: payload.notes ?? null,
        terms: payload.terms ?? null,
        customer_id: payload.customer_id ?? null,

        shipping: payload.shipping ?? 0,
      })
      .eq("id", existing.id)
      .select().single();
    if (error) throw new Error(error.message);
    result = data;
  } else {
    const companyId = resolved.companyId;
    if (!companyId) throw new Error("company_id is required to create a quotation");
    const quotation_id = payload.quotation_id || (await generateQuotationId(supabase, companyId));
    const { data, error } = await supabase.from("quotations").insert({
      quotation_id,
      order_id: resolved.uuid,
      company_id: companyId,
      customer_id: payload.customer_id ?? null,
      signage_options: payload.signage_options ?? [],
      subtotal: payload.subtotal,
      discount: payload.discount,
      tax: payload.tax,
      grand_total: payload.grand_total,
      status: payload.status || "Draft",
      notes: payload.notes ?? null,
      terms: payload.terms ?? null,
      shipping: payload.shipping ?? 0,

    }).select().single();
    if (error) throw new Error(error.message);
    result = data;
  }

  revalidatePath(`/admin/orders/${resolved.friendly}`);
  revalidatePath(`/staff/orders/${resolved.friendly}`);
  revalidatePath("/admin/orders");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Quotation Status Actions (Admin)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin approves quotation — marks it approved, moves order stage to Quotation Sent */
export async function sendQuotationToCustomer(quotationId: string, adminName: string) {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const { data: qt, error: qErr } = await supabase.from("quotations").select("order_id, quotation_id, status").eq("id", quotationId).single();
  if (qErr || !qt) throw new Error("Quotation not found");

  const wasSentBefore = qt.status === "Sent";

  const { error } = await supabase.from("quotations").update({
    status: "Sent",
    admin_approved_at: new Date().toISOString(),
    admin_approved_by: adminName,
  }).eq("id", quotationId);
  if (error) throw new Error(error.message);

  await supabase.from("orders").update({ stage: "Quotation Sent" }).eq("id", qt.order_id);
  await supabase.from("order_activity").insert({
    order_id: qt.order_id,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Quotation ${qt.quotation_id} approved by ${adminName} and sent to the customer.`,
    metadata: { action: "quotation_sent", quotation_id: qt.quotation_id }
  });

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: wasSentBefore ? "revised_quotation_ready" : "quotation_ready",
    orderUuid: qt.order_id,
    idempotencyKey: `${wasSentBefore ? "revised_quotation" : "quotation_ready"}:${quotationId}:${Date.now()}`,
    baseUrl,
  });

  revalidatePath("/admin/orders");
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Customer Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin override: mark quotation Approved and set order to Quotation Approved
 * so the order can advance to Design/Production without waiting on the customer.
 */
export async function adminMarkQuotationApprovedAction(orderId: string) {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const { uuid, friendly } = await resolveOrderId(supabase, orderId);

  const { error: qErr } = await supabase
    .from("quotations")
    .update({ status: "Approved", customer_response: "Admin" })
    .eq("order_id", uuid);
  if (qErr) throw new Error(qErr.message);

  const { error: oErr } = await supabase
    .from("orders")
    .update({ stage: "Quotation Approved", stage_status: "Normal" })
    .eq("id", uuid);
  if (oErr) throw new Error(oErr.message);

  await supabase.from("order_activity").insert({
    order_id: uuid,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: "Admin marked the quotation as approved and ready to advance.",
    metadata: { action: "quotation_approved_by_admin" },
  });

  revalidatePath(`/admin/orders/${friendly}`);
  revalidatePath("/admin/orders");
}

/** Customer approves quotation → stage = Quotation Approved */
export async function customerApproveQuotation(orderId: string, customerName: string) {
  const supabase = await getSupabase();
  const { uuid, friendly } = await resolveOrderId(supabase, orderId);

  await supabase.from("quotations").update({ status: "Approved", customer_response: "Yes" }).eq("order_id", uuid);
  await supabase.from("orders").update({ stage: "Quotation Approved" }).eq("id", uuid);
  await supabase.from("order_activity").insert({
    order_id: uuid,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `${customerName} has approved the quotation. Order is ready for advance payment.`,
    metadata: { action: "quotation_approved_by_customer" }
  });

  revalidatePath(`/admin/orders/${friendly}`);
}

/** Customer requests revision → stage = Quotation Negotiation */
export async function customerRequestRevision(orderId: string, customerName: string, notes: string) {
  const supabase = await getSupabase();
  const { uuid, friendly } = await resolveOrderId(supabase, orderId);

  await supabase.from("quotations").update({ status: "Rejected", customer_response: "Revision" }).eq("order_id", uuid);
  await supabase.from("orders").update({ stage: "Quotation Negotiation" }).eq("id", uuid);
  await supabase.from("order_activity").insert({
    order_id: uuid,
    activity_type: "customer",
    actor_name: customerName,
    actor_role: "Customer",
    content: `Revision Requested: ${notes}`,
    metadata: { action: "quotation_revision_requested" }
  });

  revalidatePath(`/admin/orders/${friendly}`);
}


