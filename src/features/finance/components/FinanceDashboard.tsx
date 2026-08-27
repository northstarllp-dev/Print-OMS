"use client";

import React, { useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  Plus,
  ReceiptText,
  Wallet,
  X,
} from "lucide-react";
import type {
  ExpenseCategory,
  FinanceExpenseRecord,
  FinanceOtherIncomeRecord,
  FinancePaymentRecord,
  FinanceReceiptRecord,
  FinanceSummary,
  OtherIncomeCategory,
  OutgoingPaymentCategory,
  OutgoingPaymentStatus,
  ReceiptMode,
} from "@/features/finance/types";
import {
  EXPENSE_CATEGORIES,
  OTHER_INCOME_CATEGORIES,
  OUTGOING_CATEGORIES,
  RECEIPT_MODES,
} from "@/features/finance/types";
import {
  createFinanceExpenseAction,
  createFinanceOtherIncomeAction,
  createFinancePaymentAction,
  createFinanceReceiptAction,
  setFinancePaymentStatusAction,
} from "@/features/finance/actions/financeActions";

interface Option {
  id: string;
  label: string;
}

interface FinanceDashboardProps {
  summary: FinanceSummary;
  receipts: FinanceReceiptRecord[];
  payments: FinancePaymentRecord[];
  expenses: FinanceExpenseRecord[];
  otherIncome: FinanceOtherIncomeRecord[];
  options: {
    customers: Option[];
    orders: Option[];
    invoices: Option[];
    vendors: Option[];
    purchaseOrders: Option[];
  };
  isAdmin: boolean;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const inputCls = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const labelCls = "block text-[11px] font-bold uppercase text-slate-500";

export function FinanceDashboard({
  summary,
  receipts,
  payments,
  expenses,
  otherIncome,
  options,
  isAdmin,
}: FinanceDashboardProps) {
  const [tab, setTab] = useState<
    "overview" | "receipts" | "payments" | "expenses" | "income" | "reports"
  >("overview");
  const [modal, setModal] = useState<
    "receipt" | "payment" | "expense" | "income" | null
  >(null);

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">Finance</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Sales income, PO / purchase payments, operating expenses, and other income synced from Orders &amp; Purchases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModal("receipt")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowDownToLine size={15} /> Sales Income
          </button>
          <button
            type="button"
            onClick={() => setModal("payment")}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <ArrowUpFromLine size={15} /> PO / Purchase
          </button>
          <button
            type="button"
            onClick={() => setModal("expense")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <ReceiptText size={15} /> Expense
          </button>
          <button
            type="button"
            onClick={() => setModal("income")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Wallet size={15} /> Other Income
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Sales Income", value: inr(summary.revenue) },
          { label: "PO / Purchase Paid", value: inr(summary.outgoingPaid) },
          { label: "Operating Expenses", value: inr(summary.expenses) },
          { label: "Profit", value: inr(summary.profit) },
          { label: "Receivables", value: inr(summary.receivables) },
          { label: "Payables", value: inr(summary.payables) },
          { label: "Other Income", value: inr(summary.otherIncome) },
          { label: "GST Collected / Paid", value: `${inr(summary.gstCollected)} / ${inr(summary.gstPaid)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: "overview", label: "Overview" },
          { id: "receipts", label: `Sales Income (${receipts.length})` },
          { id: "payments", label: `PO / Purchase (${payments.length})` },
          { id: "expenses", label: `Expenses (${expenses.length})` },
          { id: "income", label: `Other Income (${otherIncome.length})` },
          { id: "reports", label: "Reports" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewTab summary={summary} /> : null}
      {tab === "receipts" ? <ReceiptsTable receipts={receipts} /> : null}
      {tab === "payments" ? <PaymentsTable payments={payments} isAdmin={isAdmin} /> : null}
      {tab === "expenses" ? <ExpensesTable expenses={expenses} /> : null}
      {tab === "income" ? <OtherIncomeTable income={otherIncome} /> : null}
      {tab === "reports" ? <ReportsTab summary={summary} /> : null}

      {modal === "receipt" ? (
        <ReceiptModal options={options} onClose={() => setModal(null)} />
      ) : null}
      {modal === "payment" ? (
        <PaymentModal options={options} onClose={() => setModal(null)} />
      ) : null}
      {modal === "expense" ? <ExpenseModal onClose={() => setModal(null)} /> : null}
      {modal === "income" ? <OtherIncomeModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ── Overview & Reports ───────────────────────────────────────────────────────

function BarPair({ month, income, expense, max }: { month: string; income: number; expense: number; max: number }) {
  const iw = max > 0 ? Math.max(2, (income / max) * 100) : 2;
  const ew = max > 0 ? Math.max(2, (expense / max) * 100) : 2;
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-bold text-slate-500">{month}</div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 rounded bg-emerald-500" style={{ width: `${iw}%` }} />
        <span className="text-[10px] font-semibold text-slate-500">{inr(income)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 rounded bg-rose-400" style={{ width: `${ew}%` }} />
        <span className="text-[10px] font-semibold text-slate-500">{inr(expense)}</span>
      </div>
    </div>
  );
}

function OverviewTab({ summary }: { summary: FinanceSummary }) {
  const max = Math.max(
    ...summary.monthlySeries.map((m) => Math.max(m.income, m.expense)),
    1
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-4 flex items-center gap-2 text-sm font-extrabold text-slate-800">
          <Landmark size={15} /> Income vs Expense (last 6 months)
        </h3>
        <div className="space-y-4">
          {summary.monthlySeries.map((m) => (
            <BarPair key={m.month} month={m.month} income={m.income} expense={m.expense} max={max} />
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded bg-emerald-500" /> Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded bg-rose-400" /> Expense
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-4 text-sm font-extrabold text-slate-800">Cash Flow Snapshot</h3>
        <table className="w-full">
          <tbody>
            {[
              ["Sales income", inr(summary.revenue)],
              ["Other income", inr(summary.otherIncome)],
              ["Operating expenses", `- ${inr(summary.expenses)}`],
              ["PO / purchase paid", `- ${inr(summary.outgoingPaid)}`],
              ["Net", inr(summary.profit)],
            ].map(([label, value], i, arr) => (
              <tr key={label} className={i === arr.length - 1 ? "border-t border-slate-200" : ""}>
                <td className="py-2 text-sm text-slate-600">{label}</td>
                <td className={`py-2 text-right text-sm font-bold ${i === arr.length - 1 ? "text-slate-900" : "text-slate-700"}`}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab({ summary }: { summary: FinanceSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-3 text-sm font-extrabold text-slate-800">Profit &amp; Loss</h3>
        <table className="w-full">
          <tbody>
            {[
              ["Revenue (receipts)", inr(summary.revenue)],
              ["Other income", inr(summary.otherIncome)],
              ["Total income", inr(summary.revenue + summary.otherIncome)],
              ["Expenses", inr(summary.expenses)],
              ["Outgoing payments (paid)", inr(summary.outgoingPaid)],
              ["Net profit", inr(summary.profit)],
            ].map(([label, value], i) => (
              <tr key={label} className={i === 2 || i === 5 ? "border-t border-slate-200 font-bold" : ""}>
                <td className="py-1.5 text-sm text-slate-600">{label}</td>
                <td className="py-1.5 text-right text-sm font-semibold text-slate-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-3 text-sm font-extrabold text-slate-800">GST Summary</h3>
        <table className="w-full">
          <tbody>
            {[
              ["GST collected (paid invoices)", inr(summary.gstCollected)],
              ["GST paid (expenses + payments)", inr(summary.gstPaid)],
              ["Net GST position", inr(summary.gstCollected - summary.gstPaid)],
            ].map(([label, value], i) => (
              <tr key={label} className={i === 2 ? "border-t border-slate-200 font-bold" : ""}>
                <td className="py-1.5 text-sm text-slate-600">{label}</td>
                <td className="py-1.5 text-right text-sm font-semibold text-slate-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-3 text-sm font-extrabold text-slate-800">Expense Analysis</h3>
        {summary.expenseByCategory.length ? (
          <table className="w-full">
            <tbody>
              {summary.expenseByCategory.map((e) => (
                <tr key={e.category}>
                  <td className="py-1.5 text-sm text-slate-600">{e.category}</td>
                  <td className="py-1.5 text-right text-sm font-semibold text-slate-800">{inr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="m-0 text-sm text-slate-400">No expenses recorded.</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="m-0 mb-3 text-sm font-extrabold text-slate-800">Outstanding</h3>
        <table className="w-full">
          <tbody>
            {[
              ["Outstanding invoices (receivables)", inr(summary.receivables)],
              ["Outstanding to vendors (payables)", inr(summary.payables)],
              ["Upcoming payments (30 days)", inr(summary.upcomingPayments)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="py-1.5 text-sm text-slate-600">{label}</td>
                <td className="py-1.5 text-right text-sm font-semibold text-slate-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

function TableShell({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px]">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  );
}

function ReceiptsTable({ receipts }: { receipts: FinanceReceiptRecord[] }) {
  return (
    <TableShell
      headers={["Receipt #", "Date", "Customer", "Order", "Payment", "Mode", "Amount"]}
    >
      {receipts.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-4 py-3 text-sm font-bold text-slate-900">{r.receipt_no || "-"}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{r.received_at}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{r.customer_name || "-"}</td>
          <td className="px-4 py-3 text-xs font-semibold text-slate-700">
            {r.order_code || r.invoice_code || "-"}
          </td>
          <td className="px-4 py-3 text-sm text-slate-700">{r.payment_name || r.notes || "-"}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{r.mode || "-"}</td>
          <td className="px-4 py-3 text-sm font-bold text-emerald-700">{inr(r.amount)}</td>
        </tr>
      ))}
      {receipts.length === 0 ? (
        <EmptyRow colSpan={7} text="No received payments yet. Mark payments received in Payments & Collections." />
      ) : null}
    </TableShell>
  );
}

function PaymentsTable({
  payments,
  isAdmin,
}: {
  payments: FinancePaymentRecord[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const setStatus = (id: string, status: OutgoingPaymentStatus) => {
    startTransition(async () => {
      await setFinancePaymentStatusAction(id, status);
      window.location.reload();
    });
  };
  return (
    <TableShell headers={["Category", "Payee", "PO", "Due", "Amount", "Status", "Actions"]}>
      {payments.map((p) => (
        <tr key={p.id} className="border-t border-slate-100">
          <td className="px-4 py-3 text-sm font-semibold text-slate-800">{p.category}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{p.payee || p.vendor_name || "-"}</td>
          <td className="px-4 py-3 text-xs text-slate-600">{p.po_number || "-"}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{p.due_date || "-"}</td>
          <td className="px-4 py-3 text-sm font-bold text-rose-700">{inr(p.amount)}</td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                p.status === "Paid"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : p.status === "Approved"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {p.status}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex gap-1.5">
              {isAdmin && p.status === "Pending" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus(p.id, "Approved")}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                >
                  Approve
                </button>
              ) : null}
              {p.status !== "Paid" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setStatus(p.id, "Paid")}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                >
                  Mark Paid
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
      {payments.length === 0 ? <EmptyRow colSpan={7} text="No outgoing payments yet." /> : null}
    </TableShell>
  );
}

function ExpensesTable({ expenses }: { expenses: FinanceExpenseRecord[] }) {
  return (
    <TableShell headers={["Date", "Category", "Amount", "GST", "Attachment", "Notes"]}>
      {expenses.map((e) => (
        <tr key={e.id} className="border-t border-slate-100">
          <td className="px-4 py-3 text-sm text-slate-700">{e.expense_date}</td>
          <td className="px-4 py-3 text-sm font-semibold text-slate-800">{e.category}</td>
          <td className="px-4 py-3 text-sm font-bold text-slate-900">{inr(e.amount)}</td>
          <td className="px-4 py-3 text-sm text-slate-700">{inr(e.gst_amount)}</td>
          <td className="px-4 py-3 text-xs">
            {e.attachment_url ? (
              <a href={e.attachment_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">
                View
              </a>
            ) : (
              "-"
            )}
          </td>
          <td className="px-4 py-3 text-xs text-slate-600">{e.notes || "-"}</td>
        </tr>
      ))}
      {expenses.length === 0 ? <EmptyRow colSpan={6} text="No expenses yet." /> : null}
    </TableShell>
  );
}

function OtherIncomeTable({ income }: { income: FinanceOtherIncomeRecord[] }) {
  return (
    <TableShell headers={["Date", "Category", "Amount", "Notes"]}>
      {income.map((i) => (
        <tr key={i.id} className="border-t border-slate-100">
          <td className="px-4 py-3 text-sm text-slate-700">{i.income_date}</td>
          <td className="px-4 py-3 text-sm font-semibold text-slate-800">{i.category}</td>
          <td className="px-4 py-3 text-sm font-bold text-emerald-700">{inr(i.amount)}</td>
          <td className="px-4 py-3 text-xs text-slate-600">{i.notes || "-"}</td>
        </tr>
      ))}
      {income.length === 0 ? <EmptyRow colSpan={4} text="No other income recorded." /> : null}
    </TableShell>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-base font-extrabold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
          >
            <X size={14} className="text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useModalSubmit(fn: () => Promise<void>) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await fn();
        window.location.reload();
      } catch (err: any) {
        setError(err.message || "Failed to save.");
      }
    });
  };
  return { isPending, error, submit };
}

function ErrorNote({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
      {error}
    </div>
  );
}

function SubmitRow({ isPending, onClose, label }: { isPending: boolean; onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
        Cancel
      </button>
      <button type="submit" disabled={isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {isPending ? "Saving..." : label}
      </button>
    </div>
  );
}

function ReceiptModal({
  options,
  onClose,
}: {
  options: FinanceDashboardProps["options"];
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<ReceiptMode>("Cash");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [notes, setNotes] = useState("");

  const { isPending, error, submit } = useModalSubmit(async () => {
    await createFinanceReceiptAction({
      amount: Number(amount),
      mode,
      receivedAt,
      customerId: customerId || null,
      orderId: orderId || null,
      invoiceId: invoiceId || null,
      notes,
    });
  });

  return (
    <ModalShell title="Record Sales Income" onClose={onClose}>
      <p className="m-0 mb-3 text-xs text-slate-500">
        Customer / order receipts. Sales payments recorded on Orders also appear here automatically.
      </p>
      <ErrorNote error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as ReceiptMode)} className={inputCls}>
              {RECEIPT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {options.customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Order</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {options.orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Invoice</label>
            <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {options.invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <SubmitRow isPending={isPending} onClose={onClose} label="Save Sales Income" />
      </form>
    </ModalShell>
  );
}

function PaymentModal({
  options,
  onClose,
}: {
  options: FinanceDashboardProps["options"];
  onClose: () => void;
}) {
  const [category, setCategory] = useState<OutgoingPaymentCategory>("PO");
  const [payee, setPayee] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [amount, setAmount] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const { isPending, error, submit } = useModalSubmit(async () => {
    await createFinancePaymentAction({
      category,
      payee,
      vendorId: vendorId || null,
      poId: poId || null,
      amount: Number(amount),
      gstAmount: gstAmount ? Number(gstAmount) : 0,
      dueDate: dueDate || null,
      notes,
    });
  });

  return (
    <ModalShell title="Record PO / Purchase Payment" onClose={onClose}>
      <p className="m-0 mb-3 text-xs text-slate-500">
        Outgoing payments for vendors and purchase orders. Changing a PO payment status also updates this list.
      </p>
      <ErrorNote error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as OutgoingPaymentCategory)} className={inputCls}>
              {OUTGOING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Payee</label>
            <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Person / company" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vendor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {options.vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Attach PO</label>
            <select value={poId} onChange={(e) => setPoId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {options.purchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>GST (₹)</label>
            <input type="number" min="0" step="0.01" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <SubmitRow isPending={isPending} onClose={onClose} label="Save PO Payment" />
      </form>
    </ModalShell>
  );
}

function ExpenseModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("Office");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { isPending, error, submit } = useModalSubmit(async () => {
    await createFinanceExpenseAction({
      category,
      expenseDate,
      amount: Number(amount),
      gstAmount: gstAmount ? Number(gstAmount) : 0,
      attachmentUrl: attachmentUrl || null,
      notes,
    });
  });

  return (
    <ModalShell title="Record Operating Expense" onClose={onClose}>
      <p className="m-0 mb-3 text-xs text-slate-500">
        Rent, fuel, travel, marketing, and other operating costs (not PO purchases).
      </p>
      <ErrorNote error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputCls}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>GST (₹)</label>
            <input type="number" min="0" step="0.01" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Attachment URL</label>
            <input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://... (bill / receipt)" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <SubmitRow isPending={isPending} onClose={onClose} label="Save Expense" />
      </form>
    </ModalShell>
  );
}

function OtherIncomeModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<OtherIncomeCategory>("Interest");
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { isPending, error, submit } = useModalSubmit(async () => {
    await createFinanceOtherIncomeAction({
      category,
      incomeDate,
      amount: Number(amount),
      notes,
    });
  });

  return (
    <ModalShell title="Record Other Income" onClose={onClose}>
      <ErrorNote error={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as OtherIncomeCategory)} className={inputCls}>
              {OTHER_INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
        <SubmitRow isPending={isPending} onClose={onClose} label="Save Income" />
      </form>
    </ModalShell>
  );
}
