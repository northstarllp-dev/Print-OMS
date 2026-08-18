"use client";

import React, { useState } from "react";
import { Truck, Package, Loader2 } from "lucide-react";
import { markOrderAsCustomerPickup } from "@/features/orders/actions/orderActions";

interface DeliveryMethodChooserProps {
  orderId: string;
  onChooseInstallation: () => void;
  onPickupConfirmed: () => void;
}

export function DeliveryMethodChooser({
  orderId,
  onChooseInstallation,
  onPickupConfirmed,
}: DeliveryMethodChooserProps) {
  const [submitting, setSubmitting] = useState(false);

  const handlePickup = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await markOrderAsCustomerPickup(orderId);
      onPickupConfirmed();
    } catch (err: any) {
      alert(err.message || "Failed to set customer pickup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-[15px] font-extrabold text-slate-900">How will this order be delivered?</h3>
        <p className="text-xs text-slate-500 mt-1">Choose the delivery method for this order</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onChooseInstallation}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-[var(--color-primary)] hover:bg-blue-50/40 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Truck size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">Schedule Installation</div>
            <div className="text-[11px] text-slate-500 mt-0.5">We deliver and install on-site</div>
          </div>
        </button>

        <button
          type="button"
          onClick={handlePickup}
          disabled={submitting}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-amber-500 hover:bg-amber-50/40 transition-all group disabled:opacity-60"
        >
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
            {submitting ? (
              <Loader2 size={24} className="text-amber-600 animate-spin" />
            ) : (
              <Package size={24} className="text-amber-600" />
            )}
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900">Customer Pickup</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Customer collects from our location</div>
          </div>
        </button>
      </div>
    </div>
  );
}
