"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import {
  assertStageEditPermission,
} from "@/features/orders/workspace/shared/serverPermissions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { computeQuotationTotals } from "@/features/quotations/utils/lineAmount";
import {
  assertUpsertStatusTransition,
  assertValidInvoiceStatus,
  assertCanSendInvoice,
  sanitizeSignageOptions,
  toCustomerVisibleInvoice,
} from "@/features/invoices/utils/invoiceSecurity";
import { createAdminClient } from "@/utils/supabase/admin";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { ensureDraftInvoiceFromQuotation } from "@/features/invoices/lib/ensureDraftInvoice";
import { allocateInvoiceNumber } from "@/features/invoices/lib/allocateInvoiceNumber";
import { isLegacyInvoiceNumber } from "@/features/invoices/types/invoiceNumbering";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* Server Component */
          }
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

async function assertInvoiceViewPermission(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (profile.role === "admin") return;
  const { canView, canEdit } = resolveStagePermission("invoice", {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!canView && !canEdit) {
    throw new Error("Forbidden: you do not have permission to view invoices");
  }
}

function revalidateInvoicePaths(invoiceId?: string | null, orderCode?: string | null) {
  revalidatePath("/admin/invoices");
  revalidatePath("/staff/invoices");
  if (invoiceId) {
    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath(`/staff/invoices/${invoiceId}`);
  }
  if (orderCode) {
    revalidatePath(`/admin/orders/${orderCode}`);
    revalidatePath(`/staff/orders/${orderCode}`);
    revalidatePath(`/portal/order/${orderCode}`);
  }
  revalidatePath("/portal");
}

async function resolveOrderId(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  orderId: string
): Promise<{
  uuid: string;
  friendly: string;
  customerId?: string;
  companyId?: string;
}> {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(orderId)) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, order_id, customer_id, company_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (o) {
      return {
        uuid: o.id,
        friendly: o.order_id || o.id,
        customerId: o.customer_id,
        companyId: o.company_id,
      };
    }
    return { uuid: orderId, friendly: orderId };
  }
  const { data: o } = await supabase
    .from("orders")
    .select("order_id, customer_id, company_id")
    .eq("id", orderId)
    .maybeSingle();
  return {
    uuid: orderId,
    friendly: o?.order_id || orderId,
    customerId: o?.customer_id,
    companyId: o?.company_id,
  };
}

export interface InvoiceListItem {
  id: string;
  invoiceId: string;
  status: string;
  invoiceDate: string | null;
  dueDate: string | null;
  grandTotal: number;
  orderId: string;
  orderCode: string;
  businessName: string;
  clientName: string;
  customerName: string | null;
  createdAt: string | null;
}

export async function listInvoices(statusFilter?: string): Promise<InvoiceListItem[]> {
  await assertInvoiceViewPermission();
  const supabase = await getSupabase();

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_id, status, invoice_date, due_date, grand_total, order_id, created_at, orders!inner(order_id, business_name, client_name), customers(name)"
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    invoiceId: row.invoice_id || "—",
    status: row.status,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    grandTotal: Number(row.grand_total || 0),
    orderId: row.order_id,
    orderCode: row.orders?.order_id || row.order_id,
    businessName: row.orders?.business_name || "",
    clientName: row.orders?.client_name || "",
    customerName: row.customers?.name ?? null,
    createdAt: row.created_at,
  }));
}

export async function getInvoiceById(invoiceUuid: string) {
  await assertInvoiceViewPermission();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, orders!inner(id, order_id, business_name, client_name, customer_id, company_id), customers(id, name, billing_address, city)"
    )
    .eq("id", invoiceUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return data;

  // One-time upgrade: Draft invoices still on legacy INV-001 style → company config format
  if (
    data.status === "Draft" &&
    isLegacyInvoiceNumber(data.invoice_id as string | null) &&
    data.company_id
  ) {
    try {
      const upgraded = await regenerateDraftInvoiceNumber(invoiceUuid);
      if (upgraded?.invoice_id) {
        return { ...data, invoice_id: upgraded.invoice_id };
      }
    } catch {
      /* keep legacy id if allocate fails */
    }
  }

  return data;
}

/**
 * Re-allocate a human-readable invoice number from company numbering settings.
 * Only allowed while status is Draft.
 */
export async function regenerateDraftInvoiceNumber(invoiceUuid: string) {
  await assertStageEditPermission("invoice");
  const supabase = await getSupabase();

  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_id, company_id, order_id")
    .eq("id", invoiceUuid)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "Draft") {
    throw new Error("Only draft invoices can have their number regenerated");
  }
  if (!inv.company_id) throw new Error("company_id is required");

  const { invoiceId } = await allocateInvoiceNumber(supabase, inv.company_id);

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({ invoice_id: invoiceId })
    .eq("id", invoiceUuid)
    .eq("status", "Draft")
    .select("id, invoice_id")
    .single();
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", inv.order_id)
    .maybeSingle();

  revalidateInvoicePaths(invoiceUuid, orderRow?.order_id);
  return updated;
}

export async function getInvoiceByOrderId(orderId: string) {
  await assertInvoiceViewPermission();
  const supabase = await getSupabase();
  const { uuid } = await resolveOrderId(supabase, orderId);
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", uuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Portal SSR only — caller MUST verify portal token and order ownership before calling.
 * Returns null for Draft / Void invoices.
 */
export async function getCustomerVisibleInvoiceForOrder(orderUuid: string) {
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toCustomerVisibleInvoice(data as Record<string, unknown> | null);
}

export interface InvoicePayload {
  signage_options?: unknown[];
  discount?: number;
  shipping?: number;
  status?: string;
  notes?: string;
  terms?: string;
  invoice_date?: string | null;
  due_date?: string | null;
}

export async function upsertInvoice(invoiceUuid: string, payload: InvoicePayload) {
  await assertStageEditPermission("invoice");
  const supabase = await getSupabase();

  const { data: existing, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, order_id, company_id")
    .eq("id", invoiceUuid)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) throw new Error("Invoice not found");

  const signageOptions = sanitizeSignageOptions(payload.signage_options);
  const nextStatus = assertValidInvoiceStatus(payload.status ?? existing.status);
  assertUpsertStatusTransition(existing.status, nextStatus);

  const totals = computeQuotationTotals(
    signageOptions,
    payload.discount ?? 0,
    payload.shipping ?? 0
  );

  const { data, error } = await supabase
    .from("invoices")
    .update({
      signage_options: signageOptions,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      shipping: totals.shipping,
      grand_total: totals.grand_total,
      status: nextStatus,
      notes: payload.notes ?? null,
      terms: payload.terms ?? null,
      invoice_date: payload.invoice_date || undefined,
      due_date: payload.due_date ?? null,
    })
    .eq("id", invoiceUuid)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", existing.order_id)
    .maybeSingle();

  revalidateInvoicePaths(invoiceUuid, orderRow?.order_id);
  return data;
}

export async function sendInvoiceToCustomer(invoiceUuid: string) {
  await assertStageEditPermission("invoice");
  const supabase = await getSupabase();
  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_id, order_id, company_id")
    .eq("id", invoiceUuid)
    .single();
  if (fetchErr || !inv) throw new Error("Invoice not found");

  assertCanSendInvoice(inv.status);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Sent" })
    .eq("id", invoiceUuid);
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", inv.order_id)
    .maybeSingle();

  if (orderRow?.company_id) {
    await insertOrderActivity(supabase, {
      order_id: orderRow.order_id || inv.order_id,
      company_id: orderRow.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Invoice ${inv.invoice_id} sent to the customer.`,
      metadata: { action: "invoice_sent", invoice_id: inv.invoice_id },
    });
  }

  revalidateInvoicePaths(invoiceUuid, orderRow?.order_id);
}

export async function voidInvoice(invoiceUuid: string) {
  await assertStageEditPermission("invoice");
  const supabase = await getSupabase();
  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_id, order_id")
    .eq("id", invoiceUuid)
    .single();
  if (fetchErr || !inv) throw new Error("Invoice not found");
  if (inv.status === "Paid") {
    throw new Error("Cannot void a paid invoice");
  }
  if (inv.status === "Void") return;

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Void" })
    .eq("id", invoiceUuid);
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", inv.order_id)
    .maybeSingle();

  if (orderRow?.company_id) {
    await insertOrderActivity(supabase, {
      order_id: orderRow.order_id || inv.order_id,
      company_id: orderRow.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Invoice ${inv.invoice_id} voided.`,
      metadata: { action: "invoice_voided", invoice_id: inv.invoice_id },
    });
  }

  revalidateInvoicePaths(invoiceUuid, orderRow?.order_id);
}

export async function markInvoicePaid(invoiceUuid: string) {
  await assertStageEditPermission("invoice");
  const supabase = await getSupabase();
  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_id, order_id")
    .eq("id", invoiceUuid)
    .single();
  if (fetchErr || !inv) throw new Error("Invoice not found");
  if (inv.status === "Void") {
    throw new Error("Cannot mark a voided invoice as paid");
  }
  if (inv.status !== "Sent" && inv.status !== "Paid") {
    throw new Error("Only sent invoices can be marked paid");
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Paid" })
    .eq("id", invoiceUuid);
  if (error) throw new Error(error.message);

  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", inv.order_id)
    .maybeSingle();

  if (orderRow?.company_id) {
    await insertOrderActivity(supabase, {
      order_id: orderRow.order_id || inv.order_id,
      company_id: orderRow.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Invoice ${inv.invoice_id} marked as paid.`,
      metadata: { action: "invoice_paid", invoice_id: inv.invoice_id },
    });
  }

  revalidateInvoicePaths(invoiceUuid, orderRow?.order_id);
}
