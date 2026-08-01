"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { syncFinancePaymentFromPo } from "@/features/finance/syncFinance";
import { applyStockMovement } from "@/features/inventory/stockCore";
import type {
  PoPaymentStatus,
  PurchaseOrderLine,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  PurchaseRequestLine,
  PurchaseRequestRecord,
  VendorRecord,
} from "@/features/purchases/types";

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
          } catch {}
        },
      },
    }
  );
}

async function requireProfile() {
  const profile = await getCurrentUser();
  if (!profile) throw new Error("Unauthorized");
  if (!profile.company_id) throw new Error("Company context missing");
  return profile;
}

function revalidatePurchasePaths() {
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/inventory");
}

function newLineId() {
  return crypto.randomUUID();
}

function parseLines(raw: unknown): PurchaseOrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: any) => ({
    id: String(l.id),
    product_id: String(l.product_id),
    qty_ordered: Number(l.qty_ordered) || 0,
    qty_received: Number(l.qty_received) || 0,
    unit_cost: Number(l.unit_cost) || 0,
    tax_rate: Number(l.tax_rate) || 0,
    product_name: l.product_name ?? "",
    product_code: l.product_code ?? "",
    unit: l.unit ?? null,
  }));
}

async function enrichLines(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  companyId: string,
  lines: PurchaseOrderLine[]
): Promise<PurchaseOrderLine[]> {
  const ids = [...new Set(lines.map((l) => l.product_id).filter(Boolean))];
  if (!ids.length) return lines;
  const { data } = await supabase
    .from("products")
    .select("id, name, product_id, unit")
    .eq("company_id", companyId)
    .in("id", ids);
  const map = new Map((data ?? []).map((p) => [p.id, p]));
  return lines.map((l) => {
    const p = map.get(l.product_id);
    return {
      ...l,
      product_name: p?.name ?? l.product_name ?? "",
      product_code: p?.product_id ?? l.product_code ?? "",
      unit: p?.unit ?? l.unit ?? null,
    };
  });
}

// ── Vendors ──────────────────────────────────────────────────────────────────

export async function getVendors(): Promise<VendorRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const [vendorsRes, posRes] = await Promise.all([
    supabase
      .from("vendors")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("vendor_id, grand_total, payment_status, status")
      .eq("company_id", profile.company_id)
      .eq("doc_type", "order"),
  ]);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);
  if (posRes.error) throw new Error(posRes.error.message);

  const stats = new Map<string, { count: number; outstanding: number }>();
  for (const po of posRes.data ?? []) {
    if (po.status === "Cancelled") continue;
    const s = stats.get(po.vendor_id) ?? { count: 0, outstanding: 0 };
    s.count += 1;
    if (po.payment_status !== "Paid") s.outstanding += Number(po.grand_total);
    stats.set(po.vendor_id, s);
  }

  return (vendorsRes.data ?? []).map((v: any) => ({
    ...v,
    rating: v.rating != null ? Number(v.rating) : null,
    po_count: stats.get(v.id)?.count ?? 0,
    outstanding_total: stats.get(v.id)?.outstanding ?? 0,
  }));
}

export async function createVendorAction(input: {
  name: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  rating?: number | null;
  notes?: string;
}): Promise<VendorRecord> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (!input.name.trim()) throw new Error("Vendor name is required");

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      company_id: profile.company_id,
      name: input.name.trim(),
      gstin: input.gstin?.trim() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      rating: input.rating ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePurchasePaths();
  return data as VendorRecord;
}

export async function updateVendorAction(
  id: string,
  updates: Partial<{
    name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    rating: number | null;
    notes: string;
    is_active: boolean;
  }>
) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("vendors")
    .update(updates)
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);
  revalidatePurchasePaths();
}

// ── Purchase requests (doc_type = request on purchase_orders) ─────────────────

export async function getPurchaseRequests(): Promise<PurchaseRequestRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, requester:requested_by(name), approver:approved_by(name)")
    .eq("company_id", profile.company_id)
    .eq("doc_type", "request")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    status: row.status,
    lines: Array.isArray(row.lines) ? row.lines : [],
    notes: row.notes,
    requested_by: row.requested_by,
    approved_by: row.approved_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    requester_name: row.requester?.name ?? "",
    approver_name: row.approver?.name ?? "",
  }));
}

export async function createPurchaseRequestAction(input: {
  lines: PurchaseRequestLine[];
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const lines = (input.lines ?? []).filter((l) => l.product_id && l.quantity > 0);
  if (lines.length === 0) throw new Error("Add at least one line");

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      company_id: profile.company_id,
      doc_type: "request",
      vendor_id: null,
      status: "Pending",
      payment_status: "Pending",
      lines,
      receipts: [],
      notes: input.notes?.trim() || null,
      created_by: profile.id,
      requested_by: profile.id,
      subtotal: 0,
      tax: 0,
      grand_total: 0,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePurchasePaths();
  return data;
}

export async function setPurchaseRequestStatusAction(
  id: string,
  status: "Approved" | "Rejected"
) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can approve requests");
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status, approved_by: profile.id })
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "request")
    .eq("status", "Pending");
  if (error) throw new Error(error.message);
  revalidatePurchasePaths();
}

// ── Purchase orders ──────────────────────────────────────────────────────────

export async function getPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`*, vendor:vendor_id(name)`)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const lines = await enrichLines(supabase, profile.company_id, parseLines(row.lines));
      return {
        ...row,
        subtotal: Number(row.subtotal),
        tax: Number(row.tax),
        grand_total: Number(row.grand_total),
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
        receipts: Array.isArray(row.receipts) ? row.receipts : [],
        vendor_name: row.vendor?.name ?? "",
        lines,
      } as PurchaseOrderRecord;
    })
  );
  return rows;
}

export async function createPurchaseOrderAction(input: {
  vendorId: string;
  requestId?: string | null;
  expectedDate?: string | null;
  notes?: string;
  lines: { productId: string; qty: number; unitCost: number; taxRate?: number }[];
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const linesIn = (input.lines ?? []).filter((l) => l.productId && l.qty > 0);
  if (!input.vendorId) throw new Error("Select a vendor");
  if (linesIn.length === 0) throw new Error("Add at least one line");

  const lines = linesIn.map((l) => ({
    id: newLineId(),
    product_id: l.productId,
    qty_ordered: l.qty,
    qty_received: 0,
    unit_cost: l.unitCost,
    tax_rate: l.taxRate ?? 0,
  }));
  const subtotal = lines.reduce((sum, l) => sum + l.qty_ordered * l.unit_cost, 0);
  const tax = lines.reduce(
    (sum, l) => sum + (l.qty_ordered * l.unit_cost * l.tax_rate) / 100,
    0
  );

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({
      company_id: profile.company_id,
      doc_type: "order",
      vendor_id: input.vendorId,
      request_id: input.requestId ?? null,
      expected_date: input.expectedDate || null,
      notes: input.notes?.trim() || null,
      lines,
      receipts: [],
      subtotal,
      tax,
      grand_total: subtotal + tax,
      created_by: profile.id,
    })
    .select("id, po_number")
    .single();
  if (error) throw new Error(error.message);

  if (input.requestId) {
    await supabase
      .from("purchase_orders")
      .update({ status: "Converted" })
      .eq("id", input.requestId)
      .eq("company_id", profile.company_id)
      .eq("doc_type", "request");
  }

  revalidatePurchasePaths();
  return po;
}

export async function setPurchaseOrderStatusAction(
  id: string,
  status: PurchaseOrderStatus
) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order");
  if (error) throw new Error(error.message);
  revalidatePurchasePaths();
}

export async function setPurchaseOrderPaymentStatusAction(
  id: string,
  paymentStatus: PoPaymentStatus
) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ payment_status: paymentStatus })
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order");
  if (error) throw new Error(error.message);

  await syncFinancePaymentFromPo(supabase, {
    companyId: profile.company_id,
    poId: id,
    paymentStatus,
    actorId: profile.id,
  });

  revalidatePurchasePaths();
  revalidatePath("/admin/finance");
}

/**
 * Receive material against a PO: stock in + bump qty_received in lines jsonb + append receipt.
 */
export async function receivePurchaseOrderAction(input: {
  poId: string;
  warehouseId: string;
  lines: { lineId: string; qty: number }[];
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const receiveLines = (input.lines ?? []).filter((l) => l.qty > 0);
  if (receiveLines.length === 0) throw new Error("Enter quantities to receive");
  if (!input.warehouseId) throw new Error("Select a warehouse");

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, lines, receipts")
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order")
    .eq("id", input.poId)
    .single();
  if (poError) throw new Error(poError.message);
  if (["Cancelled", "Closed"].includes(po.status)) {
    throw new Error(`Cannot receive against a ${po.status} PO`);
  }

  const lines = parseLines(po.lines);
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const receiptLines: Record<string, unknown>[] = [];

  for (const rcv of receiveLines) {
    const line = lineMap.get(rcv.lineId);
    if (!line) throw new Error("PO line not found");
    const remaining = line.qty_ordered - line.qty_received;
    if (rcv.qty > remaining) {
      throw new Error(`Cannot receive more than remaining (${remaining}) on a line`);
    }

    await applyStockMovement(supabase, {
      companyId: profile.company_id,
      productId: line.product_id,
      warehouseId: input.warehouseId,
      direction: "in",
      txnType: "purchase",
      quantity: rcv.qty,
      unitCost: line.unit_cost,
      reference: po.po_number,
      notes: input.notes ?? null,
      actorId: profile.id,
    });

    line.qty_received += rcv.qty;
    receiptLines.push({
      line_id: line.id,
      product_id: line.product_id,
      qty: rcv.qty,
      unit_cost: line.unit_cost,
    });
  }

  const receipts = Array.isArray(po.receipts) ? [...po.receipts] : [];
  receipts.push({
    id: newLineId(),
    warehouse_id: input.warehouseId,
    lines: receiptLines,
    notes: input.notes?.trim() || null,
    received_by: profile.id,
    received_at: new Date().toISOString(),
  });

  const fullyReceived = lines.every((l) => l.qty_received >= l.qty_ordered);
  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      lines,
      receipts,
      status: fullyReceived ? "Received" : "Partially Received",
    })
    .eq("id", po.id)
    .eq("company_id", profile.company_id);
  if (updateError) throw new Error(updateError.message);

  revalidatePurchasePaths();
  return { status: fullyReceived ? "Received" : "Partially Received" };
}

export async function updatePurchaseOrderAction(input: {
  poId: string;
  vendorId: string;
  expectedDate?: string | null;
  notes?: string;
  lines: { id?: string; productId: string; qty: number; unitCost: number; taxRate?: number }[];
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can edit purchase orders");
  const supabase = await getSupabase();

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("id, status, lines")
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order")
    .eq("id", input.poId)
    .single();
  if (poError) throw new Error(poError.message);
  if (["Cancelled", "Closed"].includes(po.status)) {
    throw new Error(`Cannot edit a ${po.status} PO`);
  }
  if (!input.vendorId) throw new Error("Select a vendor");

  const existing = parseLines(po.lines);
  const existingById = new Map(existing.map((l) => [l.id, l]));
  const linesIn = (input.lines ?? []).filter((l) => l.productId && l.qty > 0);
  if (linesIn.length === 0) throw new Error("Add at least one line");

  const lines = linesIn.map((l) => {
    const prev = l.id ? existingById.get(l.id) : undefined;
    const qtyReceived = prev?.qty_received ?? 0;
    if (l.qty < qtyReceived) {
      throw new Error(
        `Cannot set qty below already received (${qtyReceived}) for a line`
      );
    }
    if (prev && prev.product_id !== l.productId && qtyReceived > 0) {
      throw new Error("Cannot change product on a line that already has receipts");
    }
    return {
      id: prev?.id ?? newLineId(),
      product_id: l.productId,
      qty_ordered: l.qty,
      qty_received: qtyReceived,
      unit_cost: l.unitCost,
      tax_rate: l.taxRate ?? 0,
    };
  });

  for (const prev of existing) {
    if (prev.qty_received > 0 && !lines.some((l) => l.id === prev.id)) {
      throw new Error("Cannot remove a line that already has receipts");
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.qty_ordered * l.unit_cost, 0);
  const tax = lines.reduce(
    (sum, l) => sum + (l.qty_ordered * l.unit_cost * l.tax_rate) / 100,
    0
  );

  let status = po.status as PurchaseOrderStatus;
  if (!["Cancelled", "Closed"].includes(status)) {
    const anyReceived = lines.some((l) => l.qty_received > 0);
    const fullyReceived = lines.every((l) => l.qty_received >= l.qty_ordered);
    if (fullyReceived && anyReceived) status = "Received";
    else if (anyReceived) status = "Partially Received";
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      vendor_id: input.vendorId,
      expected_date: input.expectedDate || null,
      notes: input.notes?.trim() || null,
      lines,
      subtotal,
      tax,
      grand_total: subtotal + tax,
      status,
    })
    .eq("id", input.poId)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order");
  if (error) throw new Error(error.message);

  revalidatePurchasePaths();
}

/**
 * Delete a PO. Reverses any goods receipts out of inventory, removes linked
 * finance payment sync row, then deletes the PO.
 */
export async function deletePurchaseOrderAction(poId: string) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can delete purchase orders");
  const supabase = await getSupabase();

  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, lines, receipts")
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order")
    .eq("id", poId)
    .single();
  if (poError) throw new Error(poError.message);

  const lines = parseLines(po.lines);
  const lineCost = new Map(lines.map((l) => [l.id, l.unit_cost]));
  const receipts = Array.isArray(po.receipts) ? po.receipts : [];

  for (const receipt of receipts) {
    const warehouseId = String((receipt as any).warehouse_id || "");
    if (!warehouseId) continue;
    const rLines = Array.isArray((receipt as any).lines) ? (receipt as any).lines : [];
    for (const rl of rLines) {
      const qty = Number(rl.qty) || 0;
      const productId = String(rl.product_id || "");
      if (!(qty > 0) || !productId) continue;
      const unitCost =
        Number(rl.unit_cost) ||
        (rl.line_id ? lineCost.get(String(rl.line_id)) : undefined) ||
        0;

      await applyStockMovement(supabase, {
        companyId: profile.company_id,
        productId,
        warehouseId,
        direction: "out",
        txnType: "adjustment",
        quantity: qty,
        unitCost,
        reference: po.po_number,
        notes: `Reversed: deleted purchase order ${po.po_number}`,
        actorId: profile.id,
        enforceStock: false,
      });
    }
  }

  await supabase
    .from("finance_entries")
    .delete()
    .eq("company_id", profile.company_id)
    .eq("entry_type", "payment")
    .eq("source_ref", `po_payment:${po.id}`);

  const { error: deleteError } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", po.id)
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order");
  if (deleteError) throw new Error(deleteError.message);

  revalidatePurchasePaths();
  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory");
}
