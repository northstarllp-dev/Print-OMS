"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import type { PaymentGateStage } from "@/features/settings/paymentGateStages";
import {
  listPaymentGateStages,
  setPaymentGateStageEnabled,
} from "@/features/settings/actions/paymentGateSettingsActions";

export function PaymentGateSettings() {
  const [stages, setStages] = useState<PaymentGateStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStages(await listPaymentGateStages());
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (phaseKey: string, is_enabled: boolean) => {
    startTransition(async () => {
      try {
        setError(null);
        await setPaymentGateStageEnabled(phaseKey, is_enabled);
        setStages((prev) =>
          prev.map((s) => (s.stage === phaseKey ? { ...s, is_enabled } : s))
        );
      } catch (e: any) {
        setError(e.message || "Failed to update");
      }
    });
  };

  const enabledCount = stages.filter((s) => s.is_enabled).length;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/admin/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Settings
        </Link>

        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <CreditCard className="text-blue-600" size={24} />
          Payment Gate Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose which phases show the{" "}
          <strong>&quot;Is payment required before the next stage?&quot;</strong> popup.
          The popup appears only at the <strong>end</strong> of each phase (approval / completed).
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm font-bold text-slate-400">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-xs font-bold text-slate-600">
                Show payment popup after…
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {enabledCount} of {stages.length} selected
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {stages.map((row) => (
                <label
                  key={row.stage}
                  className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 ${
                    isPending ? "opacity-70" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.is_enabled}
                    disabled={isPending}
                    onChange={(e) => toggle(row.stage, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800">{row.label}</div>
                    <div className="text-[11px] text-slate-500">
                      Popup when advancing from:{" "}
                      <span className="font-semibold text-slate-600">
                        {row.stage === "site_visit"
                          ? "Site Visit Completed (incl. when audit is submitted for approval)"
                          : row.linkedStages.join(" or ")}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
