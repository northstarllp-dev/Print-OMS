"use client";

import React, { useState } from "react";
import { Package, CheckCircle, Loader2, Phone, Mail, AlertTriangle, RefreshCw } from "lucide-react";
import {
  confirmCustomerPickup,
  changeOrderDeliveryMethod,
} from "@/features/orders/actions/orderActions";

interface CustomerPickupModuleProps {
  orderId: string;
  orderNo: string;
  customerName: string;
  businessName: string;
  phone: string;
  email: string;
  productType: string;
  pickupConfirmedAt: string | null;
  canChangeMethod?: boolean;
  onMethodChanged?: () => void;
}

export function CustomerPickupModule({
  orderId,
  orderNo,
  customerName,
  businessName,
  phone,
  email,
  productType,
  pickupConfirmedAt: initialPickupAt,
  canChangeMethod = false,
  onMethodChanged,
}: CustomerPickupModuleProps) {
  const [confirming, setConfirming] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pickupConfirmedAt, setPickupConfirmedAt] = useState(initialPickupAt);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = !!pickupConfirmedAt;

  const handleConfirm = async () => {
    if (confirming || isConfirmed) return;
    setError(null);
    setConfirming(true);
    try {
      await confirmCustomerPickup(orderId);
      setPickupConfirmedAt(new Date().toISOString());
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Failed to confirm pickup";
      // Next.js digests real Server Action errors in production builds.
      const isDigest =
        /Server Components render|digest property/i.test(raw) ||
        /An error occurred in the Server Components/i.test(raw);
      setError(
        isDigest
          ? "Could not confirm pickup. Check that all payments are cleared, then try again. If it keeps failing, ask an admin to check server logs."
          : raw
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleChangeToInstallation = async () => {
    if (changing || isConfirmed) return;
    if (
      !window.confirm(
        "Switch this order to Schedule Installation? Customer pickup will be cleared."
      )
    ) {
      return;
    }
    setError(null);
    setChanging(true);
    try {
      await changeOrderDeliveryMethod(orderId, "installation");
      onMethodChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change delivery method");
    } finally {
      setChanging(false);
    }
  };

  const formattedPickupDate = pickupConfirmedAt
    ? new Date(pickupConfirmedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="bg-white border border-slate-200/70 rounded-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Package size={20} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-extrabold text-slate-900">Customer Pickup / Self Receive</h2>
              <p className="text-xs text-slate-500 mt-0.5">Customer will collect this order from our location</p>
            </div>
          </div>
          {canChangeMethod && !isConfirmed && (
            <button
              type="button"
              onClick={handleChangeToInstallation}
              disabled={changing || confirming}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {changing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Change to Installation
            </button>
          )}
        </div>

        {/* Order summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Order</div>
            <div className="text-sm font-bold text-slate-900">{orderNo}</div>
          </div>
          {businessName && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Business</div>
              <div className="text-sm font-semibold text-slate-800">{businessName}</div>
            </div>
          )}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Customer</div>
            <div className="text-sm font-semibold text-slate-800">{customerName}</div>
          </div>
          {productType && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Product</div>
              <div className="text-sm font-semibold text-slate-800">{productType}</div>
            </div>
          )}
        </div>

        {/* Contact info */}
        {(phone || email) && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Contact for coordination</div>
            <div className="flex flex-wrap gap-3">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                >
                  <Phone size={14} /> {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                >
                  <Mail size={14} /> {email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation section */}
      <div className={`border rounded-xl p-5 sm:p-6 ${
        isConfirmed
          ? "bg-emerald-50 border-emerald-200"
          : "bg-white border-slate-200/70"
      }`}>
        {isConfirmed ? (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-emerald-800">Pickup Confirmed</h3>
              <p className="text-sm text-emerald-700 mt-1">
                Customer collected the order on {formattedPickupDate}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
              <CheckCircle size={12} /> Completed
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Ready for customer collection</h3>
              <p className="text-xs text-slate-500 mt-1">
                Confirm once the customer has collected their order
              </p>
            </div>

            {error && (
              <div className="w-full flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming || changing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
            >
              {confirming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Package size={18} />
              )}
              {confirming ? "Confirming..." : "Confirm Pickup — Customer Has Collected"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
