"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  IndianRupee,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Payment, PaymentAmountType } from "@/types";
import {
  getPaymentsByOrder,
  createPayment,
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
  /** Keeps the last % the user entered so Rest/Fixed → Percentage doesn't leave a ₹ amount in the % field. */
  const lastPercentRef = useRef("50");
  const withGst = true;

  const selectPercentage = () => {
    setRestOfAmount(false);
    setNewType("percentage");
    setNewValue(lastPercentRef.current);
  };

  const selectFixed = () => {
    setRestOfAmount(false);
    setNewType("fixed");
  };

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
      const amt = withGst ? balance.outstanding : (balance.totalBeforeTax - balance.receivedTotal);
      setNewValue(String(Math.max(0, amt)));
      setNewName((n) => (isAutoPaymentName(n) ? "Rest of Amount" : n));
    } else if (!restOfAmount) {
      setNewName((n) =>
        n === "Rest of Amount" ? nextInstallmentName(payments.length) : n
      );
    }
  }, [restOfAmount, balance, payments.length, withGst]);

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
      <div className="flex flex-col md:flex-row md:items-start gap-3 md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600 shrink-0" />
            Payment Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-2 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
            Record bank transfers, UPI, cash, and cheque receipts here.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setShowAdd((v) => {
                  if (!v) {
                    setRestOfAmount(false);
                    setNewName(nextInstallmentName(payments.length));
                    setNewType("percentage");
                    lastPercentRef.current = "50";
                    setNewValue("50");
                  }
                  return !v;
                });
              }}
              className="flex-1 md:flex-none px-3 py-2 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {showAdd ? "Cancel" : "Add Payment"}
            </button>
          )}
          <button
            type="button"
            onClick={() => load()}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-slate-500">Total amount</div>
          <div className="text-lg font-bold text-slate-800 mt-0.5">
            ₹{(balance?.totalAmount ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[9px] font-semibold text-slate-400 mt-0.5">Ex-GST</div>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-violet-600">GST</div>
          <div className="text-lg font-bold text-violet-800 mt-0.5">
            ₹{(balance?.gst ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-blue-600">Total incl. GST</div>
          <div className="text-lg font-bold text-blue-800 mt-0.5">
            ₹{(balance?.grandTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase text-emerald-600">Received</div>
          <div className="text-lg font-bold text-emerald-800 mt-0.5">
            ₹{(balance?.receivedTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-black uppercase text-amber-600">Outstanding</div>
          <div className="text-lg font-bold text-amber-800 mt-0.5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Type</label>
                <div className="flex gap-4 pt-1 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={!restOfAmount && newType === "percentage"}
                      onChange={selectPercentage}
                    />
                    Percentage
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={!restOfAmount && newType === "fixed"}
                      onChange={selectFixed}
                    />
                    Fixed
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={restOfAmount}
                      onChange={() => setRestOfAmount(true)}
                    />
                    Rest of amount
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                Value ({newType === "percentage" && !restOfAmount ? "%" : "₹"})
              </label>
              <input
                type="number"
                min="0"
                max={newType === "percentage" && !restOfAmount ? "100" : undefined}
                step="0.01"
                value={newValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (newType === "percentage" && !restOfAmount) {
                    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                      setNewValue(raw);
                      const num = parseFloat(raw);
                      if (Number.isFinite(num) && num >= 0 && num <= 100) {
                        lastPercentRef.current = raw;
                      }
                    }
                    return;
                  }
                  setNewValue(raw);
                }}
                onBlur={() => {
                  if (newType !== "percentage" || restOfAmount || newValue === "") return;
                  const num = parseFloat(newValue);
                  if (!Number.isFinite(num)) {
                    setNewValue(lastPercentRef.current);
                    return;
                  }
                  const clamped = String(Math.min(100, Math.max(0, num)));
                  setNewValue(clamped);
                  lastPercentRef.current = clamped;
                }}
                disabled={restOfAmount}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {!restOfAmount && newType === "percentage" && balance && (
                <div className="text-xs font-bold text-blue-700 mt-2 bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100 flex justify-between items-center">
                  <span>% of total incl. GST →</span>
                  <span className="font-mono">
                    ₹{(
                      Math.round(
                        ((withGst ? balance.grandTotal : balance.totalBeforeTax) *
                          (parseFloat(newValue) || 0) /
                          100) *
                          100
                      ) / 100
                    ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {restOfAmount && balance && (
                <div className="text-[10px] font-semibold text-slate-500 mt-1">
                  {withGst ? "Quotation total" : "Total before tax"} − received
                </div>
              )}
            </div>
          </div>

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
                  const restAmt = withGst ? bal.outstanding : (bal.totalBeforeTax - bal.receivedTotal);
                  if (restAmt <= 0) throw new Error("No outstanding balance for this base.");
                  amountType = "fixed";
                  amount = restAmt;
                } else {
                  const num = parseFloat(newValue);
                  if (!Number.isFinite(num) || num <= 0) {
                    throw new Error("Enter a valid amount or percentage.");
                  }
                  if (newType === "percentage" && num > 100) {
                    throw new Error("Percentage cannot exceed 100%.");
                  }

                  if (newType === "fixed") {
                    amount = num;
                  } else {
                    if (withGst) {
                      percentage = num;
                    } else {
                      amountType = "fixed";
                      amount = Math.round(((balance?.totalBeforeTax || 0) * (num / 100)) * 100) / 100;
                    }
                  }
                }

                await createPayment(orderId, {
                  payment_name: newName.trim(),
                  trigger_stage: currentStage,
                  amount_type: amountType,
                  amount,
                  percentage,
                  received: true,
                });
                setShowAdd(false);
                setRestOfAmount(false);
              })
            }
            className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Payment Received"}
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
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Received
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-700 mt-0.5">
                    ₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    {p.amount_type === "percentage" && (
                      <span className="text-slate-400 font-semibold ml-1">({p.percentage}%)</span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
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
