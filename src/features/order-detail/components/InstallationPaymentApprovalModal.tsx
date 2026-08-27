"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  CreditCard,
  CheckCircle2,
  Loader2,
  IndianRupee,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";
import type { Payment } from "@/types";
import {
  getPaymentsByOrder,
  getPaymentBalanceSummary,
  createPayment,
  deletePayment,
  type PaymentBalanceSummary,
} from "@/features/payments/actions/paymentActions";

interface InstallationPaymentApprovalModalProps {
  orderId: string;
  orderLabel?: string;
  /** Override the subtitle under the title (defaults to installation wording). */
  description?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function amountOf(p: Payment): number {
  return Number(p.calculated_amount ?? p.amount ?? 0);
}

export function InstallationPaymentApprovalModal({
  orderId,
  orderLabel,
  description = "Confirm payment status before marking this order as completed.",
  onClose,
  onConfirm,
}: InstallationPaymentApprovalModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<PaymentBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingPayment, setAddingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    setDeletingId(paymentId);
    setError(null);
    try {
      await deletePayment(paymentId);
      await load();
      setPaymentConfirmed(false);
    } catch (e: any) {
      setError(e.message || "Failed to delete payment");
    } finally {
      setDeletingId(null);
    }
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
    } catch (e: any) {
      setError(e.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePaymentConfirmedChange = async (checked: boolean) => {
    setPaymentConfirmed(checked);

    if (checked && outstanding > 0) {
      setAddingPayment(true);
      setError(null);
      try {
        await createPayment(orderId, {
          payment_name: "Final Payment (Remaining Balance)",
          amount_type: "fixed",
          amount: outstanding,
          received: true,
          notes: "Automatically recorded when order was marked complete",
        });
        await load();
      } catch (e: any) {
        setError(e.message || "Failed to add remaining payment");
        setPaymentConfirmed(false); // uncheck if we couldn't record the payment
      } finally {
        setAddingPayment(false);
      }
    }
  };

  const outstanding = balance?.outstanding ?? 0;

  const handleConfirm = async () => {
    if (!paymentConfirmed) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e.message || "Failed to complete order");
      setConfirming(false);
    }
  };

  return (
    <OverlayPortal>
    <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92dvh] md:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-4 md:px-6 py-3.5 md:py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={18} className="text-blue-600 shrink-0" />
              <h2 className="text-sm md:text-base font-black text-slate-900 leading-snug">
                Review Payments & Complete Order
              </h2>
            </div>
            {orderLabel && (
              <p className="text-xs text-slate-500 font-semibold truncate">{orderLabel}</p>
            )}
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs font-bold text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading payments…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] font-black uppercase text-slate-500">Total ex-GST</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    ₹{(balance?.totalAmount ?? 0).toLocaleString("en-IN")}
                  </div>
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
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 col-span-2 md:col-span-2">
                  <div className="text-[10px] font-black uppercase text-amber-600">Outstanding</div>
                  <div className="text-lg font-bold text-amber-800 mt-0.5">
                    ₹{outstanding.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {outstanding > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    ₹{outstanding.toLocaleString("en-IN")} is still outstanding.
                    {" "}Ticking the checkbox below will automatically record it as received.
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-3">
                  Previous Payments
                </h3>
                {payments.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-500">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                              {p.amount_type === "percentage" && p.percentage != null && (
                                <span className="text-slate-400 font-semibold ml-1">({p.percentage}%)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {deletingId === p.id ? (
                              <Loader2 size={16} className="animate-spin text-slate-400" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors focus:outline-none"
                                title="Delete payment"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {received && (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <label
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  addingPayment ? "opacity-60 cursor-wait bg-slate-50 border-slate-200" : "bg-slate-50 border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="mt-0.5 relative">
                  {addingPayment ? (
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={paymentConfirmed}
                      onChange={(e) => handlePaymentConfirmedChange(e.target.checked)}
                      disabled={addingPayment}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-700 leading-snug">
                  {addingPayment
                    ? "Recording remaining payment…"
                    : "Payment completed I confirm all dues for this order have been received or reconciled."}
                  {outstanding > 0 && !paymentConfirmed && !addingPayment && (
                    <span className="block text-xs text-amber-600 font-bold mt-1">
                      This will record ₹{outstanding.toLocaleString("en-IN")} as received.
                    </span>
                  )}
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mx-2 flex gap-3 items-start">
            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-xs text-red-800 font-semibold leading-relaxed">
              <strong className="font-black text-red-900 block mb-1">WARNING: Irreversible Action</strong>
              Closing this order means no more modifications can be done. God Mode will be permanently disabled, and the order will become strictly view-only.
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-3.5 md:py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 md:gap-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || confirming || !paymentConfirmed}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <><Loader2 size={14} className="animate-spin" /> Completing…</>
            ) : (
              <><CheckCircle2 size={14} /> Mark Order Completed</>
            )}
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}
