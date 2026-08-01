"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Payment, PaymentAmountType, PaymentStatus } from "@/types";
import { assertAdminOnly } from "@/features/orders/workspace/shared/serverPermissions";
import { revalidateStaffQueuePaths } from "@/features/orders/actions/orderActions";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";
import { syncSalesReceiptFromOrderPayment } from "@/features/finance/syncFinance";

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
            // ignore
          }
        },
      },
    }
  );
}

async function requireStaffUser() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized: staff login required.");
  return user;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOrderUuid(orderId: string): Promise<string> {
  if (uuidPattern.test(orderId)) return orderId;
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !data) throw new Error(`Could not resolve order ID: ${orderId}`);
  return data.id;
}

function mapPayment(row: Record<string, unknown>): Payment {
  const status: PaymentStatus = row.status === "received" ? "received" : "expected";
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    payment_name: row.payment_name as string,
    trigger_stage: (row.trigger_stage as string) || "",
    amount_type: row.amount_type as PaymentAmountType,
    amount: row.amount != null ? Number(row.amount) : null,
    percentage: row.percentage != null ? Number(row.percentage) : null,
    calculated_amount: row.calculated_amount != null ? Number(row.calculated_amount) : null,
    status,
    notes: (row.notes as string) ?? null,
    paid_at: (row.paid_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function revalidatePaymentPaths(orderId: string) {
  await revalidateStaffQueuePaths();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/finance");
  revalidatePath("/printoms/portal");
  revalidatePath(`/printoms/portal/order/${orderId}`);
}

export type PaymentBalanceSummary = {
  totalAmount: number;
  gst: number;
  grandTotal: number;
  /** Ex-GST payable base (subtotal − discount + shipping). Used for without-GST payment math. */
  totalBeforeTax: number;
  expectedTotal: number;
  receivedTotal: number;
  outstanding: number;
};

export async function getPaymentBalanceSummary(
  orderId: string
): Promise<PaymentBalanceSummary> {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .select("grand_total, subtotal, discount, tax, shipping")
    .eq("order_id", orderUuid)
    .maybeSingle();

  if (quotationError) throw new Error(quotationError.message);

  const subtotal = Math.round((Number(quotation?.subtotal) || 0) * 100) / 100;
  const discount = Math.round((Number(quotation?.discount) || 0) * 100) / 100;
  const gst = Math.round((Number(quotation?.tax) || 0) * 100) / 100;
  const shipping = Math.round((Number(quotation?.shipping) || 0) * 100) / 100;
  const totalBeforeTax = Math.round((subtotal - discount + shipping) * 100) / 100;
  const grandTotal = Math.round(
    (Number(quotation?.grand_total) || totalBeforeTax + gst) * 100
  ) / 100;

  const payments = await getPaymentsByOrder(orderUuid);
  const expectedTotal = Math.round(
    payments
      .filter((p) => p.status === "expected")
      .reduce((s, p) => s + Number(p.calculated_amount ?? p.amount ?? 0), 0) * 100
  ) / 100;
  const receivedTotal = Math.round(
    payments
      .filter((p) => p.status === "received")
      .reduce((s, p) => s + Number(p.calculated_amount ?? p.amount ?? 0), 0) * 100
  ) / 100;
  const outstanding = Math.max(
    0,
    Math.round((grandTotal - receivedTotal) * 100) / 100
  );

  return {
    totalAmount: totalBeforeTax,
    gst,
    grandTotal,
    totalBeforeTax,
    expectedTotal,
    receivedTotal,
    outstanding,
  };
}

export async function calculatePaymentAmount(
  orderId: string,
  amountType: PaymentAmountType,
  amount?: number | null,
  percentage?: number | null
): Promise<number> {
  if (amountType === "fixed") {
    return Math.round((Number(amount) || 0) * 100) / 100;
  }
  const pct = Number(percentage) || 0;
  if (pct <= 0 || pct > 100) {
    throw new Error("Percentage must be between 0 and 100.");
  }
  const { grandTotal } = await getPaymentBalanceSummary(orderId);
  return Math.round(grandTotal * (pct / 100) * 100) / 100;
}

export async function getPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderUuid)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapPayment);
}

export interface CreatePaymentInput {
  payment_name: string;
  trigger_stage?: string;
  amount_type: PaymentAmountType;
  amount?: number | null;
  percentage?: number | null;
  notes?: string | null;
  /** If true, create already marked as received */
  received?: boolean;
}

export async function createPayment(
  orderId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  await requireStaffUser();
  await assertAdminOnly();
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);

  const calculated = await calculatePaymentAmount(
    orderUuid,
    input.amount_type,
    input.amount,
    input.percentage
  );

  const received = Boolean(input.received);
  const now = new Date().toISOString();

  const { data: order } = await supabase
    .from("orders")
    .select("order_id, stage, company_id")
    .eq("id", orderUuid)
    .single();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      order_id: orderUuid,
      payment_name: input.payment_name.trim(),
      trigger_stage: input.trigger_stage || order?.stage || "",
      amount_type: input.amount_type,
      amount: input.amount_type === "fixed" ? (input.amount ?? calculated) : null,
      percentage: input.amount_type === "percentage" ? (input.percentage ?? null) : null,
      calculated_amount: calculated,
      status: received ? "received" : "expected",
      notes: input.notes ?? null,
      paid_at: received ? now : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await insertOrderActivity(supabase, {
    order_id: order?.order_id || orderUuid,
    company_id: order?.company_id,
    actor_name: "System",
    actor_role: "System",
    content: received
      ? `Payment recorded as received: "${input.payment_name}" (₹${calculated.toLocaleString("en-IN")}).`
      : `Payment expected: "${input.payment_name}" (₹${calculated.toLocaleString("en-IN")}).`,
    metadata: { action: received ? "payment_received" : "payment_expected", payment_id: data.id },
  });

  if (received && order?.company_id) {
    await syncSalesReceiptFromOrderPayment(supabase, {
      companyId: order.company_id,
      orderUuid,
      paymentId: data.id,
      amount: calculated,
      paymentName: input.payment_name.trim(),
      paidAt: now,
    });
  }

  await revalidatePaymentPaths(orderId);
  return mapPayment(data);
}

export async function markPaymentReceived(paymentId: string): Promise<Payment> {
  await requireStaffUser();
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message || "Payment not found");

  if (current.status === "received") return mapPayment(current);

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "received",
      paid_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: order } = await supabase
    .from("orders")
    .select("order_id, company_id")
    .eq("id", current.order_id)
    .single();

  await insertOrderActivity(supabase, {
    order_id: order?.order_id || current.order_id,
    company_id: order?.company_id,
    actor_name: "Staff",
    actor_role: "Staff",
    content: `Payment received: "${current.payment_name}".`,
    metadata: { action: "payment_received", payment_id: paymentId },
  });

  if (order?.company_id) {
    await syncSalesReceiptFromOrderPayment(supabase, {
      companyId: order.company_id,
      orderUuid: current.order_id,
      paymentId: paymentId,
      amount: Number(current.calculated_amount) || 0,
      paymentName: current.payment_name,
      paidAt: data.paid_at,
    });
  }

  await revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

export async function markPaymentExpected(paymentId: string): Promise<Payment> {
  await requireStaffUser();
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message || "Payment not found");

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "expected",
      paid_at: null,
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

export async function deletePayment(paymentId: string): Promise<void> {
  await requireStaffUser();
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: current } = await supabase
    .from("payments")
    .select("order_id")
    .eq("id", paymentId)
    .maybeSingle();

  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
  if (current?.order_id) await revalidatePaymentPaths(current.order_id);
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<{
    payment_name: string;
    amount_type: PaymentAmountType;
    amount: number | null;
    percentage: number | null;
    notes: string | null;
  }>
): Promise<Payment> {
  await requireStaffUser();
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message || "Payment not found");

  const amountType = updates.amount_type ?? (current.amount_type as PaymentAmountType);
  const amount = updates.amount !== undefined ? updates.amount : current.amount;
  const percentage = updates.percentage !== undefined ? updates.percentage : current.percentage;

  let calculated_amount = current.calculated_amount;
  if (
    updates.amount_type !== undefined ||
    updates.amount !== undefined ||
    updates.percentage !== undefined
  ) {
    calculated_amount = await calculatePaymentAmount(
      current.order_id,
      amountType,
      amount,
      percentage
    );
  }

  const { data, error } = await supabase
    .from("payments")
    .update({
      ...(updates.payment_name !== undefined ? { payment_name: updates.payment_name } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      amount_type: amountType,
      amount: amountType === "fixed" ? amount : null,
      percentage: amountType === "percentage" ? percentage : null,
      calculated_amount,
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

export type OrderPaymentPayStatus = "fully_paid" | "partial" | "unpaid";

export type OrderPaymentSummary = {
  orderId: string;
  orderCode: string;
  clientName: string;
  businessName: string;
  stage: string;
  quoteTotal: number;
  receivedTotal: number;
  expectedTotal: number;
  outstanding: number;
  payStatus: OrderPaymentPayStatus;
  lastPaymentName: string | null;
  lastPaidAt: string | null;
  dateCreated: string;
  agingDays: number;
  invoiceId: string | null;
  invoiceStatus: string | null;
};

export type RecentReceipt = {
  paymentId: string;
  paymentName: string;
  amount: number;
  paidAt: string;
  orderId: string;
  orderCode: string;
  clientName: string;
  businessName: string;
};

export type CompanyCollectionsData = {
  kpis: {
    collected: number;
    outstanding: number;
    expected: number;
    ordersWithBalance: number;
    fullyPaidOrders: number;
  };
  orders: OrderPaymentSummary[];
  recentReceipts: RecentReceipt[];
};

function paymentAmount(p: { calculated_amount?: unknown; amount?: unknown }): number {
  return Number(p.calculated_amount ?? p.amount ?? 0) || 0;
}

function isReceivedPayment(p: { status?: unknown }): boolean {
  const status = String(p.status ?? "received").toLowerCase();
  return status === "received" || status === "";
}

/** Prefer Approved quote; else highest grand_total (matches order Payment tab visibility). */
function quoteTotalForOrder(quotations: unknown): number {
  const list = Array.isArray(quotations) ? quotations : quotations ? [quotations] : [];
  if (list.length === 0) return 0;

  const approved = list.find((q: any) => String(q.status || "") === "Approved");
  if (approved?.grand_total != null && Number(approved.grand_total) > 0) {
    return Number(approved.grand_total) || 0;
  }

  let max = 0;
  for (const q of list as any[]) {
    const total = Number(q.grand_total) || 0;
    if (total > max) max = total;
  }
  return max;
}

/** Company-wide collections rollup for /admin/payments (admin only). */
export async function getCompanyCollectionsData(): Promise<CompanyCollectionsData> {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_id,
      client_name,
      business_name,
      stage,
      date_created,
      quotations(grand_total, status),
      payments(id, payment_name, amount, calculated_amount, status, paid_at, created_at, updated_at),
      invoices(id, status)
    `
    )
    .order("date_created", { ascending: false });

  if (error) throw new Error(error.message);

  const orders: OrderPaymentSummary[] = [];
  const recentReceipts: RecentReceipt[] = [];
  let collected = 0;
  let outstandingSum = 0;
  let expectedSum = 0;
  let ordersWithBalance = 0;
  let fullyPaidOrders = 0;

  for (const o of data || []) {
    const payments = Array.isArray(o.payments) ? o.payments : o.payments ? [o.payments] : [];
    const quoteTotal = quoteTotalForOrder(o.quotations);
    if (quoteTotal <= 0 && payments.length === 0) continue;

    let receivedTotal = 0;
    let expectedTotal = 0;
    let lastPaidAt: string | null = null;
    let lastPaymentName: string | null = null;

    for (const p of payments as any[]) {
      const amt = paymentAmount(p);
      if (isReceivedPayment(p)) {
        receivedTotal += amt;
        const when = p.paid_at || p.updated_at || p.created_at;
        if (when && (!lastPaidAt || when > lastPaidAt)) {
          lastPaidAt = when;
          lastPaymentName = p.payment_name || "Payment";
        }
        if (when) {
          recentReceipts.push({
            paymentId: p.id,
            paymentName: p.payment_name || "Payment",
            amount: Math.round(amt * 100) / 100,
            paidAt: when,
            orderId: o.id,
            orderCode: o.order_id || o.id,
            clientName: o.client_name || "",
            businessName: o.business_name || "",
          });
        }
      } else {
        expectedTotal += amt;
      }
    }

    receivedTotal = Math.round(receivedTotal * 100) / 100;
    expectedTotal = Math.round(expectedTotal * 100) / 100;
    const outstanding =
      quoteTotal > 0 ? Math.max(0, Math.round((quoteTotal - receivedTotal) * 100) / 100) : 0;

    let payStatus: OrderPaymentPayStatus = "unpaid";
    if (quoteTotal > 0 && outstanding === 0 && receivedTotal > 0) {
      payStatus = "fully_paid";
    } else if (receivedTotal > 0 && outstanding > 0) {
      payStatus = "partial";
    } else if (quoteTotal <= 0 && receivedTotal > 0) {
      payStatus = "fully_paid";
    } else if (quoteTotal > 0 && receivedTotal === 0) {
      payStatus = "unpaid";
    }

    const now = Date.now();
    const mostRecentDate = lastPaidAt || o.date_created || "";
    const agingDays = mostRecentDate
      ? Math.max(0, Math.floor((now - new Date(mostRecentDate).getTime()) / 86_400_000))
      : 0;

    const invoicesList = Array.isArray(o.invoices) ? o.invoices : o.invoices ? [o.invoices] : [];
    const invoice = invoicesList[0] as { id: string; status: string } | undefined;

    collected += receivedTotal;
    outstandingSum += outstanding;
    expectedSum += expectedTotal;
    if (outstanding > 0) ordersWithBalance += 1;
    if (payStatus === "fully_paid") fullyPaidOrders += 1;

    orders.push({
      orderId: o.id,
      orderCode: o.order_id || o.id,
      clientName: o.client_name || "",
      businessName: o.business_name || "",
      stage: o.stage || "",
      quoteTotal,
      receivedTotal,
      expectedTotal,
      outstanding,
      payStatus,
      lastPaymentName,
      lastPaidAt,
      dateCreated: o.date_created || "",
      agingDays,
      invoiceId: invoice?.id ?? null,
      invoiceStatus: invoice?.status ?? null,
    });
  }

  orders.sort((a, b) => b.outstanding - a.outstanding || b.dateCreated.localeCompare(a.dateCreated));
  recentReceipts.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return {
    kpis: {
      collected: Math.round(collected),
      outstanding: Math.round(outstandingSum),
      expected: Math.round(expectedSum),
      ordersWithBalance,
      fullyPaidOrders,
    },
    orders,
    recentReceipts: recentReceipts.slice(0, 25),
  };
}
