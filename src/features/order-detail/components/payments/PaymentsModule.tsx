"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  CreditCard,
  CheckCircle2,
  Ban,
  Loader2,
  RefreshCw,
  IndianRupee,
  FileText,
} from "lucide-react";
import { Payment, PaymentStatus, PaymentAmountType } from "@/types";
import {
  getPaymentsByOrder,
  verifyPayment,
  waivePayment,
  updatePayment,
  createPaymentRequirement,
  getPaymentBalanceSummary,
  type PaymentBalanceSummary,
} from "@/features/payments/actions/paymentActions";
import {
  isAutoPaymentName,
  nextInstallmentName,
} from "@/features/payments/utils/installmentName";

interface PaymentsModuleProps {
  orderId: string;
  currentStage?: string;
  currentUserRole?: string;
  isEmployee?: boolean;
  onPaymentsChanged?: () => void;
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  requested: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waived: "bg-purple-50 text-purple-700 border-purple-200",
};

function formatAmount(p: Payment): string {
  const amt = p.calculated_amount ?? p.amount ?? 0;
  if (p.amount_type === "percentage") {
    return `₹${Number(amt).toLocaleString("en-IN")} (${p.percentage ?? 0}%)`;
  }
  return `₹${Number(amt).toLocaleString("en-IN")}`;
}

export const PaymentsModule: React.FC<PaymentsModuleProps> = ({
  orderId,
  currentStage = "Quotation Approved",
  currentUserRole,
  onPaymentsChanged,
}) => {
  const isAdmin = currentUserRole === "Admin";
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("1st installment");
  const [newType, setNewType] = useState<PaymentAmountType>("percentage");
  const [newValue, setNewValue] = useState("50");
  const [newRequired, setNewRequired] = useState(true);
  const [restOfAmount, setRestOfAmount] = useState(false);
  const [balance, setBalance] = useState<PaymentBalanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, bal] = await Promise.all([
        getPaymentsByOrder(orderId),
        getPaymentBalanceSummary(orderId),
      ]);
      setPayments(data);
      setBalance(bal);
      const next = nextInstallmentName(data.length);
      setNewName((n) => (isAutoPaymentName(n) && n !== "Rest of Amount" ? next : n));
    } catch (e: any) {
      setError(e.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (restOfAmount && balance) {
      setNewType("fixed");
      setNewValue(String(balance.remaining));
      setNewName((n) => (isAutoPaymentName(n) ? "Rest of Amount" : n));
    } else if (!restOfAmount) {
      setNewName((n) =>
        n === "Rest of Amount" ? nextInstallmentName(payments.length) : n
      );
    }
  }, [restOfAmount, balance, payments.length]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setError(null);
        await fn();
        await load();
        setEditingId(null);
        setShowAdd(false);
        onPaymentsChanged?.();
      } catch (e: any) {
        setError(e.message || "Action failed");
      }
    });
  };

  const outstanding = payments
    .filter((p) => !["verified", "waived"].includes(p.status))
    .reduce((s, p) => s + Number(p.calculated_amount ?? p.amount ?? 0), 0);
  const collected = payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + Number(p.calculated_amount ?? p.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600" />
            Payment Milestones
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Business payment gates between stages — not a pipeline stage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowAdd((v) => {
                  if (!v) {
                    setRestOfAmount(false);
                    setNewName(nextInstallmentName(payments.length));
                    setNewType("percentage");
                    setNewValue("50");
                  }
                  return !v;
                });
              }}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {showAdd ? "Cancel" : "Add Payment"}
            </button>
          )}
          <button
            type="button"
            onClick={() => load()}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {showAdd && isAdmin && (
        <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Payment Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <label className="flex items-start gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={restOfAmount}
              onChange={(e) => setRestOfAmount(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600"
            />
            <span>
              Rest of the amount
              <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">
                Quotation total − verified payments
                {balance
                  ? ` = ₹${balance.remaining.toLocaleString("en-IN")} (₹${balance.grandTotal.toLocaleString("en-IN")} − ₹${balance.paidTotal.toLocaleString("en-IN")})`
                  : ""}
              </span>
            </span>
          </label>

          {!restOfAmount && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Type</label>
                <div className="flex gap-3 pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input type="radio" checked={newType === "percentage"} onChange={() => setNewType("percentage")} />
                    Percentage
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input type="radio" checked={newType === "fixed"} onChange={() => setNewType("fixed")} />
                    Fixed
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Value ({newType === "percentage" ? "%" : "₹"})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
            </div>
          )}

          {restOfAmount && (
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-800 font-mono">
              Amount: ₹{(balance?.remaining ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          )}

          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
            Required before next stage
          </label>

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(async () => {
                if (!newName.trim()) throw new Error("Enter a payment name.");
                let amountType: PaymentAmountType = newType;
                let amount: number | null = null;
                let percentage: number | null = null;

                if (restOfAmount) {
                  const bal = balance || (await getPaymentBalanceSummary(orderId));
                  if (bal.remaining <= 0) throw new Error("No remaining balance on the quotation.");
                  amountType = "fixed";
                  amount = bal.remaining;
                } else {
                  const num = parseFloat(newValue);
                  if (!Number.isFinite(num) || num <= 0) {
                    throw new Error("Enter a valid amount or percentage.");
                  }
                  if (newType === "fixed") amount = num;
                  else percentage = num;
                }

                await createPaymentRequirement(orderId, {
                  payment_name: newName.trim(),
                  trigger_stage: currentStage,
                  amount_type: amountType,
                  amount,
                  percentage,
                  required_for_next_stage: newRequired,
                  lock_stage: newRequired,
                });
                setRestOfAmount(false);
                setNewName(nextInstallmentName(payments.length + 1));
                setNewValue("50");
                setNewType("percentage");
              })
            }
            className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create Milestone
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Outstanding</div>
          <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
            ₹{outstanding.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Collected</div>
          <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
            ₹{collected.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs font-bold">
          <Loader2 size={16} className="animate-spin" /> Loading payments…
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-500">No payment milestones yet</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Create one when advancing a stage if payment is required.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-800">{p.payment_name}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${STATUS_STYLE[p.status]}`}
                    >
                      {p.status}
                    </span>
                    {p.required_for_next_stage && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 space-x-2">
                    <span>Trigger: {p.trigger_stage}</span>
                    <span>·</span>
                    <span>{formatAmount(p)}</span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  {p.payment_reference && (
                    <div className="text-[11px] text-slate-600 mt-1 font-mono flex items-center gap-1">
                      <FileText size={11} /> Ref: {p.payment_reference}
                    </div>
                  )}
                  {p.notes && (
                    <div className="text-[11px] text-slate-500 mt-1">{p.notes}</div>
                  )}
                </div>

                {isAdmin && !["verified", "waived"].includes(p.status) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(p.id);
                        setNotes(p.notes || "");
                        setReference(p.payment_reference || "");
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Review
                    </button>
                  </div>
                )}
              </div>

              {editingId === p.id && isAdmin && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 space-y-2">
                  <input
                    type="text"
                    placeholder="Payment reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <textarea
                    placeholder="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        runAction(async () => {
                          await updatePayment(p.id, {
                            payment_reference: reference || null,
                            notes: notes || null,
                          });
                          await verifyPayment(p.id, {
                            payment_reference: reference || undefined,
                            notes: notes || undefined,
                          });
                        })
                      }
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} /> Verify
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        runAction(async () => {
                          await waivePayment(p.id, { notes: notes || undefined });
                        })
                      }
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                    >
                      <Ban size={12} /> Waive
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
