import type { SupabaseClient } from "@supabase/supabase-js";
import { computeQuotationTotals } from "@/features/quotations/utils/lineAmount";
import { sanitizeSignageOptions } from "@/features/invoices/utils/invoiceSecurity";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { allocateInvoiceNumber } from "@/features/invoices/lib/allocateInvoiceNumber";

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

/**
 * Idempotent: creates a Draft invoice from an approved quotation if none exists.
 * Safe to call from customer portal (admin client) or staff approve paths.
 * Not a server action accepts a live Supabase client.
 */
export async function ensureDraftInvoiceFromQuotation(
  orderUuid: string,
  client?: SupabaseClient
): Promise<{ id: string; created: boolean } | null> {
  const db = client ?? createAdminClient();
  if (!db) throw new Error("Server configuration error");

  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const { data: qt, error: qErr } = await db
    .from("quotations")
    .select(
      "id, company_id, customer_id, signage_options, discount, shipping, installation_charges, subtotal, tax, grand_total, notes, terms, status"
    )
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!qt) return null;
  if (!qt.company_id) {
    throw new Error("company_id is required to create an invoice");
  }

  const signageOptions = sanitizeSignageOptions(qt.signage_options);
  const totals = computeQuotationTotals(
    signageOptions,
    Number(qt.discount || 0),
    Number(qt.shipping || 0),
    Number((qt as { installation_charges?: number }).installation_charges || 0)
  );

  const { invoiceId } = await allocateInvoiceNumber(db, qt.company_id);

  const { data: inserted, error: iErr } = await db
    .from("invoices")
    .insert({
      order_id: orderUuid,
      quotation_row_id: qt.id,
      company_id: qt.company_id,
      customer_id: qt.customer_id,
      invoice_id: invoiceId,
      status: "Draft",
      signage_options: signageOptions,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      shipping: totals.shipping,
      grand_total: totals.grand_total,
      notes: qt.notes ?? null,
      terms: qt.terms ?? null,
    })
    .select("id, invoice_id")
    .single();

  if (iErr) {
    if (iErr.code === "23505") {
      const { data: raced } = await db
        .from("invoices")
        .select("id")
        .eq("order_id", orderUuid)
        .maybeSingle();
      if (raced) return { id: raced.id, created: false };
    }
    throw new Error(iErr.message);
  }

  const { data: orderRow } = await db
    .from("orders")
    .select("order_id, company_id")
    .eq("id", orderUuid)
    .maybeSingle();

  if (orderRow?.company_id) {
    await insertOrderActivity(db, {
      order_id: orderRow.order_id || orderUuid,
      company_id: orderRow.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Draft invoice ${inserted.invoice_id} created from approved quotation.`,
      metadata: {
        action: "invoice_auto_created",
        invoice_id: inserted.invoice_id,
      },
    });
  }

  revalidateInvoicePaths(inserted.id, orderRow?.order_id);
  return { id: inserted.id, created: true };
}
