"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CreditCard, Loader2, Upload, CheckCircle2, IndianRupee } from "lucide-react";
import { Payment, PaymentStatus } from "@/types";
import {
  getPaymentsByOrder,
  markPaymentPaid,
} from "@/features/payments/actions/paymentActions";

interface PaymentsTabProps {
  orderId: string;
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  requested: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  waived: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Upcoming",
  requested: "Due",
  paid: "Submitted",
  verified: "Verified",
  waived: "Waived",
};

function amountOf(p: Payment): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

export function PaymentsTab({ orderId }: PaymentsTabProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPaymentsByOrder(orderId);
      setPayments(data);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let expected = 0;
    let outstanding = 0;
    let paid = 0;
    for (const p of payments) {
      if (p.status === "waived") continue;
      const amt = amountOf(p);
      expected += amt;
      if (p.status === "verified") paid += amt;
      else outstanding += amt;
    }
    return {
      expected: Math.round(expected * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      paid: Math.round(paid * 100) / 100,
    };
  }, [payments]);

  const submitPayment = (paymentId: string) => {
    startTransition(async () => {
      try {
        await markPaymentPaid(paymentId, {
          payment_reference: refs[paymentId] || undefined,
          payment_method: "manual",
        });
        setMessage("Payment submitted. Our team will verify it shortly.");
        await load();
      } catch (e: any) {
        setMessage(e.message || "Failed to submit payment");
      }
    });
  };

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
          Amounts you are expected to pay for this order. Submit your transaction reference after payment.
        </p>
      </div>

      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Total expected</div>
            <div className="text-xl font-black text-blue-900 font-mono mt-1">
              ₹{totals.expected.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">Outstanding</div>
            <div className="text-xl font-black text-amber-900 font-mono mt-1">
              ₹{totals.outstanding.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Paid & verified</div>
            <div className="text-xl font-black text-emerald-900 font-mono mt-1">
              ₹{totals.paid.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          {message}
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl">
          <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-500">No payments due at this time.</p>
          <p className="text-xs text-slate-400 mt-1">When a payment is requested, it will appear here with the amount.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const amt = amountOf(p);
            const canSubmit = ["pending", "requested"].includes(p.status);
            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">{p.payment_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Related to stage: {p.trigger_stage}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${STATUS_STYLE[p.status]}`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Amount you are expected to pay
                  </div>
                  <div className="text-2xl font-black text-blue-700 font-mono mt-0.5">
                    ₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    {p.amount_type === "percentage" && (
                      <span className="text-xs font-bold text-slate-400 ml-2">
                        ({p.percentage}% of quotation)
                      </span>
                    )}
                  </div>
                </div>

                {p.status !== "waived" && p.status !== "verified" && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-700">Payment Instructions</p>
                    <p>
                      Transfer ₹{amt.toLocaleString("en-IN")} via UPI / bank transfer and enter your
                      transaction reference below. Online payment will be available soon.
                    </p>
                  </div>
                )}

                {p.payment_reference && (
                  <p className="text-xs font-mono text-slate-600">
                    Reference: {p.payment_reference}
                  </p>
                )}

                {canSubmit && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Transaction / UTR reference"
                      value={refs[p.id] || ""}
                      onChange={(e) =>
                        setRefs((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => submitPayment(p.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      Mark as Paid
                    </button>
                  </div>
                )}

                {p.status === "paid" && (
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                    <CheckCircle2 size={14} /> Submitted — awaiting verification
                  </div>
                )}

                {p.status === "verified" && (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={14} /> Payment verified
                  </div>
                )}

                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed"
                  title="Coming soon"
                >
                  Pay Online (Coming Soon)
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
