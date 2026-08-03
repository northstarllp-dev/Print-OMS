import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export function orderPaymentSyncTag(paymentId: string) {
  return `order_payment:${paymentId}`;
}

export function poPaymentSyncTag(poId: string) {
  return `po_payment:${poId}`;
}

export async function syncSalesReceiptFromOrderPayment(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    orderUuid: string;
    paymentId: string;
    amount: number;
    paymentName: string;
    paidAt?: string | null;
    actorId?: string | null;
  }
) {
  if (!(input.amount > 0)) return;

  const sourceRef = orderPaymentSyncTag(input.paymentId);

  const { data: existing } = await supabase
    .from("finance_entries")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("entry_type", "receipt")
    .eq("source_ref", sourceRef)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { data: order } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("id", input.orderUuid)
    .maybeSingle();

  const receivedAt = (input.paidAt || new Date().toISOString()).slice(0, 10);

  const { error } = await supabase.from("finance_entries").insert({
    company_id: input.companyId,
    entry_type: "receipt",
    source_ref: sourceRef,
    amount: input.amount,
    mode: "Online",
    entry_date: receivedAt,
    customer_id: order?.customer_id ?? null,
    order_id: input.orderUuid,
    notes: `Sales income · ${input.paymentName}`,
    created_by: input.actorId ?? null,
  });

  // Unique violation = another request already synced this payment.
  if (error && error.code !== "23505") throw new Error(error.message);

  revalidatePath("/admin/finance");
}

export async function syncFinancePaymentFromPo(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    poId: string;
    paymentStatus: "Pending" | "Partially Paid" | "Paid";
    actorId?: string | null;
  }
) {
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, vendor_id, grand_total, tax")
    .eq("company_id", input.companyId)
    .eq("id", input.poId)
    .eq("doc_type", "order")
    .single();
  if (error || !po) return;

  const sourceRef = poPaymentSyncTag(po.id);
  const { data: existing } = await supabase
    .from("finance_entries")
    .select("id, status")
    .eq("company_id", input.companyId)
    .eq("entry_type", "payment")
    .eq("source_ref", sourceRef)
    .limit(1)
    .maybeSingle();

  const status =
    input.paymentStatus === "Paid"
      ? "Paid"
      : input.paymentStatus === "Partially Paid"
        ? "Approved"
        : "Pending";

  const payload = {
    status,
    amount: Number(po.grand_total),
    gst_amount: Number(po.tax) || 0,
    paid_at: status === "Paid" ? new Date().toISOString() : null,
    notes: `PO / purchase · ${po.po_number}`,
    source_ref: sourceRef,
  };

  if (existing) {
    await supabase.from("finance_entries").update(payload).eq("id", existing.id);
  } else {
    const { error: insertError } = await supabase.from("finance_entries").insert({
      company_id: input.companyId,
      entry_type: "payment",
      category: "PO",
      vendor_id: po.vendor_id,
      po_id: po.id,
      entry_date: new Date().toISOString().slice(0, 10),
      created_by: input.actorId ?? null,
      attachments: [],
      ...payload,
    });
    if (insertError && insertError.code !== "23505") {
      throw new Error(insertError.message);
    }
  }

  revalidatePath("/admin/finance");
}
