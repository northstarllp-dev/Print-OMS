"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { allocateInvoiceNumber } from "@/features/invoices/lib/allocateInvoiceNumber";
import {
  syncFinancePaymentFromPo,
  syncSalesReceiptFromOrderPayment,
} from "@/features/finance/syncFinance";
import type {
  ExpenseCategory,
  FinanceExpenseRecord,
  FinanceOtherIncomeRecord,
  FinancePaymentRecord,
  FinanceReceiptRecord,
  FinanceSummary,
  InvoiceType,
  OtherIncomeCategory,
  OutgoingPaymentCategory,
  OutgoingPaymentStatus,
  ReceiptMode,
} from "@/features/finance/types";

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

function revalidateFinancePaths() {
  revalidatePath("/admin/finance");
  revalidatePath("/admin/invoices");
}

// ── Receipts (incoming) ──────────────────────────────────────────────────────

export async function getFinanceReceipts(): Promise<FinanceReceiptRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .select(
      "*, customer:customer_id(name), order:order_id(order_id, business_name), invoice:invoice_id(invoice_id)"
    )
    .eq("company_id", profile.company_id)
    .eq("entry_type", "receipt")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => {
    const notes = row.notes || "";
    const paymentName = notes.startsWith("Sales income · ")
      ? notes.replace(/^Sales income ·\s*/, "").replace(/\s·\s*order_payment:.*$/, "")
      : notes.includes("order_payment:")
        ? notes.replace(/\s·\s*order_payment:.*$/, "").replace(/^Sales income ·\s*/, "")
        : "";
    return {
      id: row.id,
      receipt_no: row.entry_no || "",
      customer_id: row.customer_id,
      order_id: row.order_id,
      invoice_id: row.invoice_id,
      amount: Number(row.amount),
      mode: row.mode,
      received_at: row.entry_date,
      notes: row.notes,
      payment_name: paymentName || undefined,
      created_at: row.created_at,
      customer_name: row.customer?.name || row.order?.business_name || "",
      order_code: row.order?.order_id ?? "",
      invoice_code: row.invoice?.invoice_id ?? "",
      source_ref: row.source_ref ?? null,
    };
  });
}

export async function createFinanceReceiptAction(input: {
  amount: number;
  mode: ReceiptMode;
  receivedAt?: string;
  customerId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (!(input.amount > 0)) throw new Error("Amount must be positive");

  const { data, error } = await supabase
    .from("finance_entries")
    .insert({
      company_id: profile.company_id,
      entry_type: "receipt",
      amount: input.amount,
      mode: input.mode,
      entry_date: input.receivedAt || new Date().toISOString().slice(0, 10),
      customer_id: input.customerId || null,
      order_id: input.orderId || null,
      invoice_id: input.invoiceId || null,
      notes: input.notes?.trim() || null,
      created_by: profile.id,
    })
    .select("id, entry_no")
    .single();
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
  return { id: data.id, receipt_no: data.entry_no };
}

// ── Outgoing payments ────────────────────────────────────────────────────────

export async function getFinancePayments(): Promise<FinancePaymentRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*, vendor:vendor_id(name), po:po_id(po_number)")
    .eq("company_id", profile.company_id)
    .eq("entry_type", "payment")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    category: row.category,
    payee: row.payee,
    vendor_id: row.vendor_id,
    po_id: row.po_id,
    amount: Number(row.amount),
    gst_amount: Number(row.gst_amount),
    due_date: row.due_date,
    status: row.status,
    paid_at: row.paid_at,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    notes: row.notes,
    created_at: row.created_at,
    vendor_name: row.vendor?.name ?? "",
    po_number: row.po?.po_number ?? "",
  }));
}

export async function createFinancePaymentAction(input: {
  category: OutgoingPaymentCategory;
  payee?: string;
  vendorId?: string | null;
  poId?: string | null;
  amount: number;
  gstAmount?: number;
  dueDate?: string | null;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (!(input.amount > 0)) throw new Error("Amount must be positive");

  const { data, error } = await supabase
    .from("finance_entries")
    .insert({
      company_id: profile.company_id,
      entry_type: "payment",
      category: input.category,
      payee: input.payee?.trim() || null,
      vendor_id: input.vendorId || null,
      po_id: input.poId || null,
      amount: input.amount,
      gst_amount: input.gstAmount ?? 0,
      due_date: input.dueDate || null,
      status: "Pending",
      entry_date: new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
      created_by: profile.id,
      attachments: [],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
  return data;
}

export async function setFinancePaymentStatusAction(
  id: string,
  status: OutgoingPaymentStatus
) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (status === "Approved" && profile.role !== "admin") {
    throw new Error("Only admins can approve payments");
  }

  const updates: Record<string, unknown> = { status };
  if (status === "Approved") updates.approved_by = profile.id;
  if (status === "Paid") updates.paid_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("finance_entries")
    .update(updates)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .eq("entry_type", "payment")
    .select("id, po_id")
    .single();
  if (error) throw new Error(error.message);

  if (status === "Paid" && data.po_id) {
    await supabase
      .from("purchase_orders")
      .update({ payment_status: "Paid" })
      .eq("id", data.po_id)
      .eq("company_id", profile.company_id);
    revalidatePath("/admin/purchase-orders");
  }

  revalidateFinancePaths();
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function getFinanceExpenses(): Promise<FinanceExpenseRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .eq("company_id", profile.company_id)
    .eq("entry_type", "expense")
    .order("entry_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    category: row.category,
    expense_date: row.entry_date,
    amount: Number(row.amount),
    gst_amount: Number(row.gst_amount),
    attachment_url: row.attachment_url,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function createFinanceExpenseAction(input: {
  category: ExpenseCategory;
  expenseDate?: string;
  amount: number;
  gstAmount?: number;
  attachmentUrl?: string | null;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (!(input.amount > 0)) throw new Error("Amount must be positive");

  const { error } = await supabase.from("finance_entries").insert({
    company_id: profile.company_id,
    entry_type: "expense",
    category: input.category,
    entry_date: input.expenseDate || new Date().toISOString().slice(0, 10),
    amount: input.amount,
    gst_amount: input.gstAmount ?? 0,
    attachment_url: input.attachmentUrl || null,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
}

// ── Other income ─────────────────────────────────────────────────────────────

export async function getFinanceOtherIncome(): Promise<FinanceOtherIncomeRecord[]> {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("finance_entries")
    .select("*")
    .eq("company_id", profile.company_id)
    .eq("entry_type", "other_income")
    .order("entry_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    category: row.category,
    income_date: row.entry_date,
    amount: Number(row.amount),
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function createFinanceOtherIncomeAction(input: {
  category: OtherIncomeCategory;
  incomeDate?: string;
  amount: number;
  notes?: string;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  if (!(input.amount > 0)) throw new Error("Amount must be positive");

  const { error } = await supabase.from("finance_entries").insert({
    company_id: profile.company_id,
    entry_type: "other_income",
    category: input.category,
    entry_date: input.incomeDate || new Date().toISOString().slice(0, 10),
    amount: input.amount,
    notes: input.notes?.trim() || null,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
}

// ── Invoice type / proforma conversion ───────────────────────────────────────

export async function setInvoiceTypeAction(invoiceUuid: string, type: InvoiceType) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can change invoice types");
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("invoices")
    .update({ invoice_type: type })
    .eq("id", invoiceUuid)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
}

/**
 * Convert a Proforma Invoice into a Tax Invoice: keeps lines/totals,
 * switches the type, resets status to Draft, and allocates a fresh number.
 */
export async function convertProformaToInvoiceAction(invoiceUuid: string) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only admins can convert proformas");
  const supabase = await getSupabase();

  const { data: inv, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, invoice_type, company_id")
    .eq("id", invoiceUuid)
    .eq("company_id", profile.company_id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (inv.invoice_type !== "Proforma Invoice") {
    throw new Error("Only proforma invoices can be converted");
  }

  const { invoiceId } = await allocateInvoiceNumber(supabase, inv.company_id);

  const { error } = await supabase
    .from("invoices")
    .update({
      invoice_type: "Tax Invoice",
      invoice_id: invoiceId,
      status: "Draft",
    })
    .eq("id", invoiceUuid)
    .eq("company_id", profile.company_id);
  if (error) throw new Error(error.message);
  revalidateFinancePaths();
  return { invoiceId };
}

// ── Dashboard summary & reports ──────────────────────────────────────────────

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data: companyOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("company_id", profile.company_id);
  const orderIds = (companyOrders ?? []).map((o) => o.id);

  const [entriesRes, invoicesRes, posRes, orderPayRes] = await Promise.all([
    supabase
      .from("finance_entries")
      .select(
        "entry_type, amount, gst_amount, status, due_date, paid_at, entry_date, category, notes, po_id, source_ref"
      )
      .eq("company_id", profile.company_id),
    supabase
      .from("invoices")
      .select("grand_total, tax, status, invoice_type, due_date")
      .eq("company_id", profile.company_id),
    supabase
      .from("purchase_orders")
      .select("id, grand_total, payment_status, status, doc_type")
      .eq("company_id", profile.company_id),
    orderIds.length
      ? supabase
          .from("payments")
          .select("calculated_amount, status, paid_at, id")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const res of [entriesRes, invoicesRes, posRes, orderPayRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const entries = entriesRes.data ?? [];
  const receipts = entries.filter((e) => e.entry_type === "receipt");
  const payments = entries.filter((e) => e.entry_type === "payment");
  const expenses = entries.filter((e) => e.entry_type === "expense");
  const income = entries.filter((e) => e.entry_type === "other_income");
  const accountInvoices = (invoicesRes.data ?? []).filter(
    (i) => i.invoice_type !== "Proforma Invoice" && i.status !== "Void"
  );
  const pos = (posRes.data ?? []).filter((po) => (po as any).doc_type !== "request");
  const orderPays = (orderPayRes.data ?? []).filter((p) => {
    const status = String(p.status ?? "received").toLowerCase();
    return status === "received" || status === "";
  });
  const orderSalesTotal = orderPays.reduce((s, p) => s + Number(p.calculated_amount || 0), 0);
  const manualReceiptTotal = receipts
    .filter(
      (r) =>
        !(
          (r as any).source_ref?.startsWith?.("order_payment:") ||
          (r.notes || "").includes("order_payment:")
        )
    )
    .reduce((s, r) => s + Number(r.amount), 0);
  // Prefer live payments total so duplicate synced rows cannot inflate Sales Income.
  const revenue = orderSalesTotal + manualReceiptTotal;

  const otherIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);

  const financePoPaidIds = new Set(
    payments.filter((p) => p.po_id && p.status === "Paid").map((p) => p.po_id as string)
  );
  const financePaidTotal = payments
    .filter((p) => p.status === "Paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const outgoingPaid =
    financePaidTotal +
    pos
      .filter(
        (po) =>
          po.payment_status === "Paid" &&
          po.status !== "Cancelled" &&
          !financePoPaidIds.has(po.id)
      )
      .reduce((s, po) => s + Number(po.grand_total), 0);

  const receivables = accountInvoices
    .filter((i) => i.status === "Sent")
    .reduce((s, i) => s + Number(i.grand_total), 0);
  const payables =
    payments
      .filter((p) => p.status !== "Paid")
      .reduce((s, p) => s + Number(p.amount), 0) +
    pos
      .filter(
        (po) =>
          po.payment_status !== "Paid" &&
          po.status !== "Cancelled" &&
          !payments.some((p) => p.po_id === po.id && p.status !== "Paid")
      )
      .reduce((s, po) => s + Number(po.grand_total), 0);

  const today = new Date().toISOString().slice(0, 10);
  const inThirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const upcomingPayments = payments
    .filter(
      (p) => p.status !== "Paid" && p.due_date && p.due_date >= today && p.due_date <= inThirtyDays
    )
    .reduce((s, p) => s + Number(p.amount), 0);

  const gstCollected = accountInvoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + Number(i.tax), 0);
  const gstPaid =
    expenses.reduce((s, e) => s + Number(e.gst_amount), 0) +
    payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.gst_amount), 0);

  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthlySeries = months.map((month) => {
    const orderMonthIncome = orderPays
      .filter((p) => p.paid_at && monthKey(p.paid_at) === month)
      .reduce((s, p) => s + Number(p.calculated_amount || 0), 0);
    const manualMonthIncome = receipts
      .filter(
        (r) =>
          !(
            (r as any).source_ref?.startsWith?.("order_payment:") ||
            (r.notes || "").includes("order_payment:")
          ) && monthKey(r.entry_date) === month
      )
      .reduce((s, r) => s + Number(r.amount), 0);
    return {
      month,
      income:
        orderMonthIncome +
        manualMonthIncome +
        income
          .filter((r) => monthKey(r.entry_date) === month)
          .reduce((s, r) => s + Number(r.amount), 0),
      expense:
        expenses
          .filter((e) => monthKey(e.entry_date) === month)
          .reduce((s, e) => s + Number(e.amount), 0) +
        payments
          .filter((p) => p.status === "Paid" && p.paid_at && monthKey(p.paid_at) === month)
          .reduce((s, p) => s + Number(p.amount), 0),
    };
  });

  const expenseByCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category || "Misc"] = (acc[e.category || "Misc"] ?? 0) + Number(e.amount);
      return acc;
    }, {})
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    revenue,
    otherIncome,
    expenses: expenseTotal,
    outgoingPaid,
    profit: revenue + otherIncome - expenseTotal - outgoingPaid,
    receivables,
    payables,
    upcomingPayments,
    gstCollected,
    gstPaid,
    monthlySeries,
    expenseByCategory,
  };
}

export async function ensureFinanceSyncedFromSources() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("company_id", profile.company_id);
  const orderIds = (orders ?? []).map((o) => o.id);

  if (orderIds.length) {
    const { data: received } = await supabase
      .from("payments")
      .select("id, order_id, payment_name, calculated_amount, paid_at, status")
      .in("order_id", orderIds);
    for (const p of received ?? []) {
      const status = String(p.status ?? "received").toLowerCase();
      if (status !== "received" && status !== "") continue;
      try {
        await syncSalesReceiptFromOrderPayment(supabase, {
          companyId: profile.company_id,
          orderUuid: p.order_id,
          paymentId: p.id,
          amount: Number(p.calculated_amount) || 0,
          paymentName: p.payment_name || "Sales payment",
          paidAt: p.paid_at,
          actorId: profile.id,
        });
      } catch {
        // Continue syncing remaining payments.
      }
    }
  }

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, payment_status")
    .eq("company_id", profile.company_id)
    .eq("doc_type", "order")
    .neq("status", "Cancelled");
  for (const po of pos ?? []) {
    try {
      await syncFinancePaymentFromPo(supabase, {
        companyId: profile.company_id,
        poId: po.id,
        paymentStatus: po.payment_status as "Pending" | "Partially Paid" | "Paid",
        actorId: profile.id,
      });
    } catch {
      // Continue syncing remaining POs.
    }
  }
}

/** Options for the receipt/payment modals. */
export async function getFinanceFormOptions() {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const [customersRes, ordersRes, invoicesRes, vendorsRes, posRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .order("name"),
    supabase
      .from("orders")
      .select("id, order_id, business_name")
      .eq("company_id", profile.company_id)
      .order("date_created", { ascending: false })
      .limit(200),
    supabase
      .from("invoices")
      .select("id, invoice_id, status, invoice_type")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("purchase_orders")
      .select("id, po_number, payment_status")
      .eq("company_id", profile.company_id)
      .eq("doc_type", "order")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  return {
    customers: customersRes.data ?? [],
    orders: ordersRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    vendors: vendorsRes.data ?? [],
    purchaseOrders: posRes.data ?? [],
  };
}
