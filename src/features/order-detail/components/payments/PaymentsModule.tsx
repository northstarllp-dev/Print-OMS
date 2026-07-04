"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  RefreshCw,
  IndianRupee,
  Trash2,
} from "lucide-react";
import { Payment, PaymentAmountType } from "@/types";
import {
  getPaymentsByOrder,
  createPayment,
  markPaymentReceived,
  markPaymentExpected,
  deletePayment,
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

function amountOf(p: Payment): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

export const PaymentsModule: React.FC<PaymentsModuleProps> = ({
  orderId,
  currentStage = "",
  currentUserRole,
  onPaymentsChanged,
}) => {
  const canEdit = currentUserRole === "Admin";
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<PaymentBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("1st installment");
  const [newType, setNewType] = useState<PaymentAmountType>("percentage");
  const [newValue, setNewValue] = useState("50");
  const [restOfAmount, setRestOfAmount] = useState(false);
  const [markReceivedOnCreate, setMarkReceivedOnCreate] = useState(false);

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
      setNewName((n) =>
        isAutoPaymentName(n) && n !== "Rest of Amount"
          ? nextInstallmentName(data.length)
          : n
      );
    } catch (e: any) {
      setError(e.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (restOfAmount && balance) {
      setNewType("fixed");
      setNewValue(String(balance.outstanding));
      setNewName((n) => (isAutoPaymentName(n) ? "Rest of Amount" : n));
    } else if (!restOfAmount) {
      setNewName((n) =>
        n === "Rest of Amount" ? nextInstallmentName(payments.length) : n
      );
    }
  }, [restOfAmount, balance, payments.length]);

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setError(null);
        await fn();
        await load();
        onPaymentsChanged?.();
      } catch (e: any) {
        setError(e.message || "Action failed");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600" />
            Payment Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Record expected and received amounts. Payments do not block the order workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setShowAdd((v) => {
                  if (!v) {
                    setRestOfAmount(false);
                    setMarkReceivedOnCreate(false);
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-slate-500">Quotation total</div>
          <div className="text-lg font-black text-slate-800 font-mono mt-0.5">
            ₹{(balance?.grandTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-emerald-600">Received</div>
          <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
            ₹{(balance?.receivedTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-amber-600">Outstanding</div>
          <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
            ₹{(balance?.outstanding ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {showAdd && canEdit && (
        <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Payment name</label>
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
                Quotation total − received
                {balance
                  ? ` = ₹${balance.outstanding.toLocaleString("en-IN")}`
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

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={markReceivedOnCreate}
              onChange={(e) => setMarkReceivedOnCreate(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            Mark as received now
          </label>

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                if (!newName.trim()) throw new Error("Enter a payment name.");
                let amountType: PaymentAmountType = newType;
                let amount: number | null = null;
                let percentage: number | null = null;

                if (restOfAmount) {
                  const bal = balance || (await getPaymentBalanceSummary(orderId));
                  if (bal.outstanding <= 0) throw new Error("No outstanding balance.");
                  amountType = "fixed";
                  amount = bal.outstanding;
                } else {
                  const num = parseFloat(newValue);
                  if (!Number.isFinite(num) || num <= 0) {
                    throw new Error("Enter a valid amount or percentage.");
                  }
                  if (newType === "fixed") amount = num;
                  else percentage = num;
                }

                await createPayment(orderId, {
                  payment_name: newName.trim(),
                  trigger_stage: currentStage,
                  amount_type: amountType,
                  amount,
                  percentage,
                  received: markReceivedOnCreate,
                });
                setShowAdd(false);
                setRestOfAmount(false);
                setMarkReceivedOnCreate(false);
              })
            }
            className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Payment"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs font-bold text-slate-400 gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-500">No payments recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const amt = amountOf(p);
            const received = p.status === "received";
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-xl bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{p.payment_name}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        received
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {received ? "Received" : "Expected"}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">
                    ₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    {p.amount_type === "percentage" && (
                      <span className="text-slate-400 font-semibold ml-1">({p.percentage}%)</span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    {received ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(async () => { await markPaymentExpected(p.id); })}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Mark expected
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(async () => { await markPaymentReceived(p.id); })}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Received
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm("Delete this payment record?")) {
                          run(async () => { await deletePayment(p.id); });
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
