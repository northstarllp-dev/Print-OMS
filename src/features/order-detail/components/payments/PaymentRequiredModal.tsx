"use client";

import React, { useEffect, useState } from "react";
import { X, CreditCard, Loader2 } from "lucide-react";
import { PaymentAmountType } from "@/types";
import {
  createPaymentRequirement,
  getPaymentBalanceSummary,
  getPaymentsByOrder,
} from "@/features/payments/actions/paymentActions";
import {
  isAutoPaymentName,
  nextInstallmentName,
} from "@/features/payments/utils/installmentName";

interface PaymentRequiredModalProps {
  orderId: string;
  currentStage: string;
  onSkip: () => Promise<void>;
  onCreated: () => void | Promise<void>;
  onClose: () => void;
}

export const PaymentRequiredModal: React.FC<PaymentRequiredModalProps> = ({
  orderId,
  currentStage,
  onSkip,
  onCreated,
  onClose,
}) => {
  /** null = only Yes/No shown; yes = expand payment details */
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [paymentName, setPaymentName] = useState("1st installment");
  const [amountType, setAmountType] = useState<PaymentAmountType>("percentage");
  const [value, setValue] = useState<string>("50");
  const [restOfAmount, setRestOfAmount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<{
    grandTotal: number;
    paidTotal: number;
    remaining: number;
  } | null>(null);
  const [defaultInstallmentName, setDefaultInstallmentName] = useState("1st installment");

  useEffect(() => {
    Promise.all([
      getPaymentBalanceSummary(orderId),
      getPaymentsByOrder(orderId),
    ])
      .then(([bal, payments]) => {
        setBalance(bal);
        const next = nextInstallmentName(payments.length);
        setDefaultInstallmentName(next);
        setPaymentName((name) =>
          isAutoPaymentName(name) && name !== "Rest of Amount" ? next : name
        );
      })
      .catch(() => {
        setBalance(null);
      });
  }, [orderId]);

  useEffect(() => {
    if (restOfAmount && balance) {
      setAmountType("fixed");
      setValue(String(balance.remaining));
      setPaymentName((name) => (isAutoPaymentName(name) ? "Rest of Amount" : name));
    } else if (!restOfAmount) {
      setPaymentName((name) =>
        name === "Rest of Amount" ? defaultInstallmentName : name
      );
    }
  }, [restOfAmount, balance, defaultInstallmentName]);

  const handleConfirm = async () => {
    if (choice === null) return;

    setBusy(true);
    setError(null);
    try {
      if (choice === "no") {
        await onSkip();
        onClose();
        return;
      }

      let amountTypeToUse = amountType;
      let amountToUse: number | null = null;
      let percentageToUse: number | null = null;

      if (restOfAmount) {
        const summary = balance || (await getPaymentBalanceSummary(orderId));
        if (summary.remaining <= 0) {
          setError("No remaining balance on the quotation.");
          setBusy(false);
          return;
        }
        amountTypeToUse = "fixed";
        amountToUse = summary.remaining;
      } else {
        const num = parseFloat(value);
        if (!Number.isFinite(num) || num <= 0) {
          setError("Enter a valid amount or percentage.");
          setBusy(false);
          return;
        }
        if (amountType === "fixed") amountToUse = num;
        else percentageToUse = num;
      }

      if (!paymentName.trim()) {
        setError("Payment name is required.");
        setBusy(false);
        return;
      }

      // Creating a payment always blocks progression until verified/waived
      await createPaymentRequirement(orderId, {
        payment_name: paymentName.trim(),
        trigger_stage: currentStage,
        amount_type: amountTypeToUse,
        amount: amountToUse,
        percentage: percentageToUse,
        required_for_next_stage: true,
        lock_stage: true,
      });

      await onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to process");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard size={16} className="text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800">
                Do you need to collect a payment before continuing?
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Current stage: {currentStage}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setChoice("no");
                setError(null);
              }}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                choice === "no"
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => {
                setChoice("yes");
                setError(null);
              }}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all ${
                choice === "yes"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              Yes
            </button>
          </div>

          {choice === "no" && (
            <p className="text-xs text-slate-500 text-center">
              Continue to the next stage without creating a payment.
            </p>
          )}

          {choice === "yes" && (
            <div className="space-y-3 border border-slate-100 rounded-xl p-4 bg-slate-50 animate-in fade-in">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Payment Name
                </label>
                <input
                  type="text"
                  value={paymentName}
                  onChange={(e) => setPaymentName(e.target.value)}
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
                <>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Type
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          checked={amountType === "percentage"}
                          onChange={() => setAmountType("percentage")}
                        />
                        Percentage
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          checked={amountType === "fixed"}
                          onChange={() => setAmountType("fixed")}
                        />
                        Fixed
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Value {amountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                </>
              )}

              {restOfAmount && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 font-mono">
                  Amount: ₹{(balance?.remaining ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              )}

              <p className="text-[10px] text-slate-500">
                The order will stay at <strong>{currentStage}</strong> with status{" "}
                <strong>Pending Payment Verification</strong> until this payment is verified or waived
                on the Payments tab.
              </p>
            </div>
          )}

          {error && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || choice === null}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {choice === "yes"
              ? "Create Payment"
              : choice === "no"
                ? "Continue"
                : "Select Yes or No"}
          </button>
        </div>
      </div>
    </div>
  );
};
