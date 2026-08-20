"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { mapSiteVisitMeasurementFromDb } from "@/features/orders/actions/siteVisitMapper";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import {
  revalidateOrderDetailPaths,
  revalidateStaffOrderDetailPaths,
} from "@/features/orders/actions/revalidateOrderPaths";
import {
  assertStageEditPermission,
} from "@/features/orders/workspace/shared/serverPermissions";
import { computeQuotationTotals } from "@/features/quotations/utils/lineAmount";
import {
  assertUpsertStatusTransition,
  assertValidQuotationStatus,
  assertCanSendQuotationToCustomer,
  sanitizeSignageOptions,
} from "@/features/quotations/utils/quotationSecurity";
import { createAdminClient } from "@/utils/supabase/admin";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";

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

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Server configuration error");
  return admin;
}

/** Resolve a friendly order_id or uuid → actual DB uuid */
async function resolveOrderId(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  orderId: string
): Promise<{
  uuid: string;
  friendly: string;
  customerId?: string;
  customerName?: string;
  companyId?: string;
  health?: string;
}> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(orderId)) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, order_id, customer_id, business_name, company_id, health")
      .eq("order_id", orderId)
      .maybeSingle();
    if (o) {
      return {
        uuid: o.id,
        friendly: o.order_id || o.id,
        customerId: o.customer_id,
        customerName: o.business_name,
        companyId: o.company_id,
        health: o.health,
      };
    }
    return { uuid: orderId, friendly: orderId };
  }
  const { data: o } = await supabase
    .from("orders")
    .select("order_id, customer_id, business_name, company_id, health")
    .eq("id", orderId)
    .maybeSingle();
  return {
    uuid: orderId,
    friendly: o?.order_id || orderId,
    customerId: o?.customer_id,
    customerName: o?.business_name,
    companyId: o?.company_id,
    health: o?.health,
  };
}

async function assertPortalOrderOwnership(
  orderUuid: string,
  portalToken?: string
): Promise<void> {
  const { assertPortalTenantAccess } = await import(
    "@/utils/portal/portalTenantAuth"
  );
  await assertPortalTenantAccess({
    orderId: orderUuid,
    portalToken,
    requiredScope: "approve_quote",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getQuotationByOrderId(orderId: string) {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }

  const supabase = await getSupabase();
  const { uuid } = await resolveOrderId(supabase, orderId);
  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("order_id", uuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Portal SSR only — caller MUST verify portal token and order ownership before calling.
 * Returns null for Draft / Pending Approval quotations.
 */
export async function getCustomerVisibleQuotationForOrder(orderUuid: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("quotations")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const { toCustomerVisibleQuotation } = await import(
    "@/features/quotations/utils/quotationSecurity"
  );
  return toCustomerVisibleQuotation(data as Record<string, unknown> | null);
}

/** Get site visit measurements for an order (signage items), mapped to UI camelCase with units. */
export async function getSiteVisitMeasurementsForOrder(orderId: string) {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");

  const supabase = await getSupabase();
  const { uuid } = await resolveOrderId(supabase, orderId);
  const { data: sv } = await supabase
    .from("site_visits")
    .select("id")
    .eq("order_id", uuid)
    .maybeSingle();
  if (!sv) return [];
  const { data, error } = await supabase
    .from("site_visit_measurements")
    .select(
      "id, name, width, width_unit, height, height_unit, depth, depth_unit, notes, ground_clearance, ground_clearance_unit"
    )
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
  signage_options?: unknown[];
  discount?: number;
  shipping?: number;
  status?: string;
  notes?: string;
  terms?: string;
  customer_id?: string;
}

async function revalidateQuotationPaths(orderId: string, scope: "staff" | "detail" = "detail") {
  if (scope === "staff") {
    revalidateStaffOrderDetailPaths(orderId);
  } else {
    revalidateOrderDetailPaths(orderId);
  }
}

/** Upsert quotation — creates if not exists, updates if already there */
export async function upsertQuotation(orderId: string, payload: QuotationPayload) {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const resolved = await resolveOrderId(supabase, orderId);

  const signageOptions = sanitizeSignageOptions(payload.signage_options);
  const nextStatus = assertValidQuotationStatus(payload.status);

  const totals = computeQuotationTotals(
    signageOptions,
    payload.discount ?? 0,
    payload.shipping ?? 0
  );

  const { data: existing } = await supabase
    .from("quotations")
    .select("id, quotation_id, status")
    .eq("order_id", resolved.uuid)
    .maybeSingle();

  assertUpsertStatusTransition(existing?.status, nextStatus);

  const customerId = payload.customer_id ?? resolved.customerId ?? null;

  const persistPayload = {
    signage_options: signageOptions,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    grand_total: totals.grand_total,
    status: nextStatus,
    notes: payload.notes ?? null,
    terms: payload.terms ?? null,
    customer_id: customerId,
    shipping: totals.shipping,
  };

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("quotations")
      .update({
        ...persistPayload,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  } else {
    const companyId = resolved.companyId;
    if (!companyId) throw new Error("company_id is required to create a quotation");
    // quotation_id assigned by DB trigger generate_quotation_id() (per company_id)
    const { data, error } = await supabase
      .from("quotations")
      .insert({
        order_id: resolved.uuid,
        company_id: companyId,
        ...persistPayload,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  }

  revalidateQuotationPaths(resolved.friendly, "staff");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Quotation Status Actions (Admin)
// ─────────────────────────────────────────────────────────────────────────────

/** Admin sends quotation to customer — marks Sent and moves order to Quotation Sent.
 *  Returns whether this was a resend after customer revision (for the message popup).
 */
export async function sendQuotationToCustomer(
  quotationId: string,
  adminName: string
): Promise<{ isRevisionResend: boolean }> {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const { data: qt, error: qErr } = await supabase
    .from("quotations")
    .select("order_id, quotation_id, status, rejection_reason, customer_response")
    .eq("id", quotationId)
    .single();
  if (qErr || !qt) throw new Error("Quotation not found");

  assertCanSendQuotationToCustomer(qt.status);

  // After customer "request changes", status may still be Rejected — or admin may
  // have saved a Draft while rejection_reason / customer_response remain set.
  const isRevisionResend =
    qt.status === "Rejected" ||
    qt.customer_response === "Revision" ||
    !!(typeof qt.rejection_reason === "string" && qt.rejection_reason.trim());

  const { error } = await supabase
    .from("quotations")
    .update({
      status: "Sent",
      admin_approved_at: new Date().toISOString(),
      admin_approved_by: adminName,
    })
    .eq("id", quotationId);
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id, company_id, health")
    .eq("id", qt.order_id)
    .maybeSingle();

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  await supabase
    .from("orders")
    .update({ stage: "Quotation Sent", ...stageProgressPatch(orderRow?.health, "Quotation Sent") })
    .eq("id", qt.order_id);
  if (!orderRow?.company_id) {
    throw new Error("company_id is required to log quotation activity");
  }
  await insertOrderActivity(supabase, {
    order_id: orderRow.order_id || qt.order_id,
    company_id: orderRow.company_id,
    actor_name: "System",
    actor_role: "System",
    content: `Quotation ${qt.quotation_id} approved by ${adminName} and sent to the customer.`,
    metadata: {
      action: "quotation_sent",
      quotation_id: qt.quotation_id,
      revision: isRevisionResend,
    },
  });

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: isRevisionResend ? "revised_quotation_ready" : "quotation_ready",
    orderUuid: qt.order_id,
    idempotencyKey: `${isRevisionResend ? "revised_quotation" : "quotation_ready"}:${quotationId}:${Date.now()}`,
    baseUrl,
  });

  revalidateQuotationPaths(orderRow?.order_id || qt.order_id);
  return { isRevisionResend };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Customer Actions (portal session + service role)
// ─────────────────────────────────────────────────────────────────────────────

export async function adminMarkQuotationApprovedAction(orderId: string) {
  await assertStageEditPermission("quotation");
  const supabase = await getSupabase();
  const { uuid, friendly, companyId, health } = await resolveOrderId(supabase, orderId);
  if (!companyId) throw new Error("company_id is required to log quotation activity");

  const { error: qErr } = await supabase
    .from("quotations")
    .update({ status: "Approved", customer_response: "Admin" })
    .eq("order_id", uuid);
  if (qErr) throw new Error(qErr.message);

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  const { error: oErr } = await supabase
    .from("orders")
    .update({ stage: "Quotation Approved", stage_status: "Normal", ...stageProgressPatch(health, "Quotation Approved") })
    .eq("id", uuid);
  if (oErr) throw new Error(oErr.message);

  await insertOrderActivity(supabase, {
    order_id: friendly,
    company_id: companyId,
    actor_name: "System",
    actor_role: "System",
    content: "Admin marked the quotation as approved and ready to advance.",
    metadata: { action: "quotation_approved_by_admin" },
  });

  const { ensureDraftInvoiceFromQuotation } = await import(
    "@/features/invoices/lib/ensureDraftInvoice"
  );
  await ensureDraftInvoiceFromQuotation(uuid, supabase);

  revalidateQuotationPaths(friendly, "staff");
}

/** Customer approves quotation → stage = Quotation Approved */
export async function customerApproveQuotation(
  orderId: string,
  customerName: string,
  portalToken?: string
) {
  const supabase = await getSupabase();
  const { uuid: portalOrderUuid } = await resolveOrderId(supabase, orderId);
  await assertPortalOrderOwnership(portalOrderUuid, portalToken);

  // Portal/anon RLS cannot read company_id — resolve via service role after ownership check.
  const admin = requireAdminClient();
  const { uuid, friendly, companyId, health } = await resolveOrderId(admin, portalOrderUuid);
  if (!companyId) throw new Error("company_id is required to log quotation activity");

  const { data: qt } = await admin
    .from("quotations")
    .select("status")
    .eq("order_id", uuid)
    .maybeSingle();
  if (!qt || qt.status !== "Sent") {
    throw new Error("Quotation is not available for approval");
  }

  const { error: qErr } = await admin
    .from("quotations")
    .update({ status: "Approved", customer_response: "Yes" })
    .eq("order_id", uuid)
    .eq("status", "Sent");
  if (qErr) throw new Error(qErr.message);

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  const { error: oErr } = await admin
    .from("orders")
    .update({ stage: "Quotation Approved", ...stageProgressPatch(health, "Quotation Approved") })
    .eq("id", uuid);
  if (oErr) throw new Error(oErr.message);

  await insertOrderActivity(admin, {
    order_id: friendly,
    company_id: companyId,
    actor_name: "System",
    actor_role: "System",
    content: `${customerName} has approved the quotation. Order is ready for advance payment.`,
    metadata: { action: "quotation_approved_by_customer" },
  });

  const { ensureDraftInvoiceFromQuotation } = await import(
    "@/features/invoices/lib/ensureDraftInvoice"
  );
  await ensureDraftInvoiceFromQuotation(uuid, admin);

  revalidateQuotationPaths(friendly);
}

/** Customer requests revision → stage = Quotation Negotiation */
export async function customerRequestRevision(
  orderId: string,
  customerName: string,
  notes: string,
  portalToken?: string
) {
  const trimmed = notes.trim();
  if (!trimmed) throw new Error("Feedback is required");

  const supabase = await getSupabase();
  const { uuid: portalOrderUuid } = await resolveOrderId(supabase, orderId);
  await assertPortalOrderOwnership(portalOrderUuid, portalToken);

  // Portal/anon RLS cannot read company_id — resolve via service role after ownership check.
  const admin = requireAdminClient();
  const { uuid, friendly, companyId, health } = await resolveOrderId(admin, portalOrderUuid);
  if (!companyId) throw new Error("company_id is required to log quotation activity");

  const { data: qt } = await admin
    .from("quotations")
    .select("status")
    .eq("order_id", uuid)
    .maybeSingle();
  if (!qt || qt.status !== "Sent") {
    throw new Error("Quotation is not available for revision");
  }

  const { error: qErr } = await admin
    .from("quotations")
    .update({
      status: "Rejected",
      customer_response: "Revision",
      rejection_reason: trimmed,
    })
    .eq("order_id", uuid)
    .eq("status", "Sent");
  if (qErr) throw new Error(qErr.message);

  const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
  const { error: oErr } = await admin
    .from("orders")
    .update({ stage: "Quotation Negotiation", ...stageProgressPatch(health, "Quotation Negotiation") })
    .eq("id", uuid);
  if (oErr) throw new Error(oErr.message);

  await insertOrderActivity(admin, {
    order_id: friendly,
    company_id: companyId,
    actor_name: customerName,
    actor_role: "Customer",
    content: `Quotation Declined. Feedback: ${trimmed}`,
    metadata: { action: "quotation_declined" },
  });

  revalidateQuotationPaths(friendly);
}
