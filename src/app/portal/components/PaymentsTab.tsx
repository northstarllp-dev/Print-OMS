"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, IndianRupee } from "lucide-react";
import { Payment } from "@/types";
import {
  getPaymentsByOrder,
  getPaymentBalanceSummary,
  type PaymentBalanceSummary,
} from "@/features/payments/actions/paymentActions";

interface PaymentsTabProps {
  orderId: string;
}

function amountOf(p: Payment): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

export function PaymentsTab({ orderId }: PaymentsTabProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<PaymentBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, bal] = await Promise.all([
        getPaymentsByOrder(orderId),
        getPaymentBalanceSummary(orderId),
      ]);
      setPayments(data);
      setBalance(bal);
    } catch {
      setPayments([]);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm font-bold">
        <Loader2 size={18} className="animate-spin" /> Loading payments…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#0b1c30] mb-1 flex items-center gap-2">
          <CreditCard size={20} className="text-blue-600" />
          Payments
        </h2>
        <p className="text-sm text-slate-500">
          Payment information for this order. Contact your account manager for payment arrangements.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quotation total</div>
          <div className="text-xl font-black text-slate-900 font-mono mt-1">
            ₹{(balance?.grandTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Received</div>
          <div className="text-xl font-black text-emerald-900 font-mono mt-1">
            ₹{(balance?.receivedTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">Outstanding</div>
          <div className="text-xl font-black text-amber-900 font-mono mt-1">
            ₹{(balance?.outstanding ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl">
          <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-500">No payment records yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const received = p.status === "received";
            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-sm font-black text-slate-800">{p.payment_name}</h3>
                  <div className="text-lg font-black text-blue-700 font-mono mt-1">
                    ₹{amountOf(p).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                    received
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {received ? "Received" : "Expected"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
