"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  Payment,
  PaymentAmountType,
  PaymentStatus,
} from "@/types";

const PAYMENT_LOCK_STATUS = "Pending Payment Verification";
const BLOCKING_STATUSES: PaymentStatus[] = ["pending", "requested", "paid"];

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
            // Server Component — ignore
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
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    payment_name: row.payment_name as string,
    trigger_stage: row.trigger_stage as string,
    amount_type: row.amount_type as PaymentAmountType,
    amount: row.amount != null ? Number(row.amount) : null,
    percentage: row.percentage != null ? Number(row.percentage) : null,
    calculated_amount: row.calculated_amount != null ? Number(row.calculated_amount) : null,
    required_for_next_stage: Boolean(row.required_for_next_stage),
    status: row.status as PaymentStatus,
    payment_method: (row.payment_method as string) ?? null,
    payment_reference: (row.payment_reference as string) ?? null,
    notes: (row.notes as string) ?? null,
    requested_at: (row.requested_at as string) ?? null,
    paid_at: (row.paid_at as string) ?? null,
    verified_at: (row.verified_at as string) ?? null,
    verified_by: (row.verified_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function revalidatePaymentPaths(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/staff/orders");
  revalidatePath(`/staff/orders/${orderId}`);
  revalidatePath("/portal");
  revalidatePath(`/portal/order/${orderId}`);
}

export type PaymentBalanceSummary = {
  grandTotal: number;
  paidTotal: number;
  remaining: number;
};

/** Quotation total minus verified payments. */
export async function getPaymentBalanceSummary(
  orderId: string
): Promise<PaymentBalanceSummary> {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);

  const { data: quotation } = await supabase
    .from("quotations")
    .select("grand_total")
    .eq("order_id", orderUuid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const grandTotal = Math.round((Number(quotation?.grand_total) || 0) * 100) / 100;

  const { data: payments } = await supabase
    .from("payments")
    .select("calculated_amount, amount, status")
    .eq("order_id", orderUuid)
    .eq("status", "verified");

  const paidTotal = Math.round(
    (payments || []).reduce(
      (sum, p) => sum + Number(p.calculated_amount ?? p.amount ?? 0),
      0
    ) * 100
  ) / 100;

  const remaining = Math.max(0, Math.round((grandTotal - paidTotal) * 100) / 100);

  return { grandTotal, paidTotal, remaining };
}

/** Resolve grand total from the order's quotation for percentage payments. */
export async function calculatePaymentAmount(
  orderId: string,
  amountType: PaymentAmountType,
  amount?: number | null,
  percentage?: number | null
): Promise<number> {
  if (amountType === "fixed") {
    return Math.round((Number(amount) || 0) * 100) / 100;
  }

  const { grandTotal } = await getPaymentBalanceSummary(orderId);
  const pct = Number(percentage) || 0;
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

/** Payments that block stage progression. */
export async function getBlockingPayments(orderId: string): Promise<Payment[]> {
  const payments = await getPaymentsByOrder(orderId);
  return payments.filter(
    (p) => p.required_for_next_stage && BLOCKING_STATUSES.includes(p.status)
  );
}

export async function assertNoBlockingPayments(orderId: string): Promise<void> {
  const blocking = await getBlockingPayments(orderId);
  if (blocking.length > 0) {
    throw new Error("Payment verification required before proceeding.");
  }
}

async function setPaymentLock(orderUuid: string, lock: boolean) {
  const supabase = await getSupabase();
  if (lock) {
    await supabase
      .from("orders")
      .update({ stage_status: PAYMENT_LOCK_STATUS })
      .eq("id", orderUuid);
    return;
  }

  // Unlock only when no blocking payments remain and status is payment lock
  const { data: order } = await supabase
    .from("orders")
    .select("stage_status")
    .eq("id", orderUuid)
    .single();

  if (order?.stage_status === PAYMENT_LOCK_STATUS) {
    const blocking = await getBlockingPayments(orderUuid);
    if (blocking.length === 0) {
      await supabase
        .from("orders")
        .update({ stage_status: "Normal" })
        .eq("id", orderUuid);
    }
  }
}

export interface CreatePaymentInput {
  payment_name: string;
  trigger_stage: string;
  amount_type: PaymentAmountType;
  amount?: number | null;
  percentage?: number | null;
  required_for_next_stage?: boolean;
  notes?: string | null;
  /** When true (default), lock order at current stage. */
  lock_stage?: boolean;
}

export async function createPaymentRequirement(
  orderId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  await requireStaffUser();
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);

  const calculated = await calculatePaymentAmount(
    orderUuid,
    input.amount_type,
    input.amount,
    input.percentage
  );

  const required = input.required_for_next_stage !== false;
  const status: PaymentStatus = required ? "requested" : "pending";

  const { data, error } = await supabase
    .from("payments")
    .insert({
      order_id: orderUuid,
      payment_name: input.payment_name.trim(),
      trigger_stage: input.trigger_stage,
      amount_type: input.amount_type,
      amount: input.amount_type === "fixed" ? (input.amount ?? calculated) : null,
      percentage: input.amount_type === "percentage" ? (input.percentage ?? null) : null,
      calculated_amount: calculated,
      required_for_next_stage: required,
      status,
      requested_at: status === "requested" ? new Date().toISOString() : null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (required && input.lock_stage !== false) {
    await setPaymentLock(orderUuid, true);
  }

  const { data: order } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", orderUuid)
    .single();

  await supabase.from("order_activity").insert({
    order_id: order?.order_id || orderUuid,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Payment requirement created: "${input.payment_name}" (₹${calculated.toLocaleString("en-IN")}).`,
    metadata: { action: "payment_created", payment_id: data.id },
  });

  revalidatePaymentPaths(orderId);
  return mapPayment(data);
}

/**
 * Staff records that a payment was already received (checklist / offline confirmation).
 * Creates a verified milestone or verifies an existing open one with the same name.
 * Does not lock the stage.
 */
export async function recordVerifiedPayment(
  orderId: string,
  input: CreatePaymentInput
): Promise<Payment> {
  const user = await requireStaffUser();
  const existing = await getPaymentsByOrder(orderId);
  const name = input.payment_name.trim();

  const alreadyDone = existing.find(
    (p) =>
      p.payment_name === name &&
      (p.status === "verified" || p.status === "waived")
  );
  if (alreadyDone) return alreadyDone;

  const open = existing.find(
    (p) => p.payment_name === name && BLOCKING_STATUSES.includes(p.status)
  );
  if (open) {
    return verifyPayment(open.id, {
      notes: input.notes ?? undefined,
      verified_by: user.id,
    });
  }

  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(orderId);
  const calculated = await calculatePaymentAmount(
    orderUuid,
    input.amount_type,
    input.amount,
    input.percentage
  );

  const { data, error } = await supabase
    .from("payments")
    .insert({
      order_id: orderUuid,
      payment_name: name,
      trigger_stage: input.trigger_stage,
      amount_type: input.amount_type,
      amount: input.amount_type === "fixed" ? (input.amount ?? calculated) : null,
      percentage: input.amount_type === "percentage" ? (input.percentage ?? null) : null,
      calculated_amount: calculated,
      required_for_next_stage: false,
      status: "verified",
      payment_method: "manual",
      notes: input.notes ?? "Recorded as received by staff",
      requested_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: order } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", orderUuid)
    .single();

  await supabase.from("order_activity").insert({
    order_id: order?.order_id || orderUuid,
    activity_type: "timeline",
    actor_name: "Admin",
    actor_role: "Admin",
    content: `Payment recorded as verified: "${name}" (₹${calculated.toLocaleString("en-IN")}).`,
    metadata: { action: "payment_recorded_verified", payment_id: data.id },
  });

  revalidatePaymentPaths(orderId);
  return mapPayment(data);
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<{
    payment_name: string;
    amount_type: PaymentAmountType;
    amount: number | null;
    percentage: number | null;
    required_for_next_stage: boolean;
    payment_method: string | null;
    payment_reference: string | null;
    notes: string | null;
    status: PaymentStatus;
  }>
): Promise<Payment> {
  await requireStaffUser();
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
      ...updates,
      amount: amountType === "fixed" ? amount : null,
      percentage: amountType === "percentage" ? percentage : null,
      calculated_amount,
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

/** Customer marks payment as submitted (paid) with optional reference. */
export async function markPaymentPaid(
  paymentId: string,
  opts?: { payment_reference?: string; payment_method?: string; notes?: string }
): Promise<Payment> {
  const supabase = await getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (fetchError || !current) throw new Error(fetchError?.message || "Payment not found");

  if (current.status === "verified" || current.status === "waived") {
    return mapPayment(current);
  }

  // Portal (anon) may only submit payment — never verify/waive via this path.
  const { data, error } = await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: opts?.payment_reference ?? current.payment_reference,
      payment_method: opts?.payment_method ?? current.payment_method ?? "manual",
      notes: opts?.notes ?? current.notes,
    })
    .eq("id", paymentId)
    .in("status", ["pending", "requested", "paid"])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: order } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", current.order_id)
    .single();

  await supabase.from("order_activity").insert({
    order_id: order?.order_id || current.order_id,
    activity_type: "timeline",
    actor_name: "Customer",
    actor_role: "Customer",
    content: `Payment submitted: "${current.payment_name}".`,
    metadata: { action: "payment_paid", payment_id: paymentId },
  });

  revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

export async function verifyPayment(
  paymentId: string,
  opts?: { payment_reference?: string; notes?: string; verified_by?: string }
): Promise<Payment> {
  const user = await requireStaffUser();
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
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: opts?.verified_by ?? user.id,
      payment_reference: opts?.payment_reference ?? current.payment_reference,
      notes: opts?.notes ?? current.notes,
      payment_method: current.payment_method || "manual",
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await setPaymentLock(current.order_id, false);

  const { data: order } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", current.order_id)
    .single();

  await supabase.from("order_activity").insert({
    order_id: order?.order_id || current.order_id,
    activity_type: "timeline",
    actor_name: "Admin",
    actor_role: "Admin",
    content: `Payment verified: "${current.payment_name}".`,
    metadata: { action: "payment_verified", payment_id: paymentId },
  });

  revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}

export async function waivePayment(
  paymentId: string,
  opts?: { notes?: string; verified_by?: string }
): Promise<Payment> {
  const user = await requireStaffUser();
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
      status: "waived",
      verified_at: new Date().toISOString(),
      verified_by: opts?.verified_by ?? user.id,
      notes: opts?.notes ?? current.notes,
    })
    .eq("id", paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await setPaymentLock(current.order_id, false);

  const { data: order } = await supabase
    .from("orders")
    .select("order_id")
    .eq("id", current.order_id)
    .single();

  await supabase.from("order_activity").insert({
    order_id: order?.order_id || current.order_id,
    activity_type: "timeline",
    actor_name: "Admin",
    actor_role: "Admin",
    content: `Payment waived: "${current.payment_name}".`,
    metadata: { action: "payment_waived", payment_id: paymentId },
  });

  revalidatePaymentPaths(current.order_id);
  return mapPayment(data);
}
