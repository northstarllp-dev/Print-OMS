"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, IndianRupee } from "lucide-react";
import { Payment } from "@/types";
import {
  getPortalPaymentsTabData,
  type PaymentBalanceSummary,
} from "@/features/payments/actions/paymentActions";
import { PrintomsLoading } from "@/components/ui/PrintomsLoading";

interface PaymentsTabProps {
  orderId: string;
}

function amountOf(p: Payment): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

type CacheEntry = {
  payments: Payment[];
  balance: PaymentBalanceSummary;
};

/** Survives hide/show keep-alive and brief remounts within the same session. */
const paymentsTabCache = new Map<string, CacheEntry>();

export function PaymentsTab({ orderId }: PaymentsTabProps) {
  const cached = paymentsTabCache.get(orderId);
  const [payments, setPayments] = useState<Payment[]>(cached?.payments ?? []);
  const [balance, setBalance] = useState<PaymentBalanceSummary | null>(
    cached?.balance ?? null
  );
  const [loading, setLoading] = useState(!cached);
  const loadedFor = useRef<string | null>(cached ? orderId : null);

  const load = useCallback(async (force = false) => {
    if (!force && loadedFor.current === orderId && paymentsTabCache.has(orderId)) {
      const hit = paymentsTabCache.get(orderId)!;
      setPayments(hit.payments);
      setBalance(hit.balance);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { payments: data, balance: bal } = await getPortalPaymentsTabData(orderId);
      paymentsTabCache.set(orderId, { payments: data, balance: bal });
      loadedFor.current = orderId;
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
    void load();
  }, [load]);

  if (loading && !balance) {
    return <PrintomsLoading />;
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total amount</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            ₹{(balance?.totalAmount ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Ex-GST</div>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-violet-600">GST</div>
          <div className="text-lg font-bold text-violet-900 mt-1">
            ₹{(balance?.gst ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Total incl. GST</div>
          <div className="text-lg font-bold text-blue-900 mt-1">
            ₹{(balance?.grandTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Received</div>
          <div className="text-lg font-bold text-emerald-900 mt-1">
            ₹{(balance?.receivedTotal ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">Outstanding</div>
          <div className="text-lg font-bold text-amber-900 mt-1">
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
                  <h3 className="text-sm font-bold text-slate-800">{p.payment_name}</h3>
                  <div className="text-base font-bold text-blue-700 mt-1">
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
