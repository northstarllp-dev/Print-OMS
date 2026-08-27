"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  CalendarClock,
  CreditCard,
  Loader2,
  CheckCircle2,
  Circle,
  Info,
  FileUp,
  Palette,
} from "lucide-react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";

interface ProductionAdvanceModalProps {
  orderLabel?: string;
  initialDeadline?: string | null;
  hasDesignProofs: boolean;
  isDesignApproved: boolean;
  hasProductionFiles: boolean;
  onClose: () => void;
  /** Persist deadline and start fabrication (advance to Production). */
  onConfirm: (installationDeadline: string) => Promise<void>;
  /** Optional: save deadline (if set) and jump to the Payments tab without advancing. */
  onGoToPayments: (installationDeadline: string | null) => void | Promise<void>;
  /** Jump to Design tab (upload proofs / production files). */
  onGoToDesign: () => void;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10);
  }
  return d.toISOString().split("T")[0];
}

function subtractOneDay(yyyyMmDd: string): string | null {
  if (!yyyyMmDd) return null;
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StepRow({
  done,
  title,
  detail,
  action,
}: {
  done: boolean;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 flex gap-2.5 ${
        done ? "border-emerald-100 bg-emerald-50/70" : "border-slate-200 bg-slate-50/80"
      }`}
    >
      {done ? (
        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <Circle size={16} className="text-slate-400 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className={`text-xs font-bold ${done ? "text-emerald-900" : "text-slate-800"}`}>
          {title}
        </p>
        <p className={`text-xs leading-relaxed ${done ? "text-emerald-800" : "text-slate-600"}`}>
          {detail}
        </p>
        {action}
      </div>
    </div>
  );
}

export function ProductionAdvanceModal({
  orderLabel,
  initialDeadline,
  hasDesignProofs,
  isDesignApproved,
  hasProductionFiles,
  onClose,
  onConfirm,
  onGoToPayments,
  onGoToDesign,
}: ProductionAdvanceModalProps) {
  const [deadline, setDeadline] = useState(toDateInputValue(initialDeadline));
  const [confirming, setConfirming] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productionDeadline = useMemo(() => subtractOneDay(deadline), [deadline]);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const prerequisitesMet = hasDesignProofs && isDesignApproved && hasProductionFiles;
  const canContinue = prerequisitesMet && Boolean(deadline);

  const handleConfirm = async () => {
    if (!hasDesignProofs) {
      setError("Upload design proofs on the Design tab first.");
      return;
    }
    if (!isDesignApproved) {
      setError("Design must be approved by the customer, or use admin approve (skip customer).");
      return;
    }
    if (!hasProductionFiles) {
      setError("Upload final production files on the Design tab before starting fabrication.");
      return;
    }
    if (!deadline) {
      setError("Please set an installation deadline.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      await onConfirm(deadline);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start fabrication");
      setConfirming(false);
    }
  };

  const handleGoToPayments = async () => {
    setRedirecting(true);
    setError(null);
    try {
      await onGoToPayments(deadline || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open payments");
      setRedirecting(false);
    }
  };

  const busy = confirming || redirecting;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] md:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          <div className="px-4 md:px-6 py-3.5 md:py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={18} className="text-blue-600 shrink-0" />
                <h2 className="text-sm md:text-base font-black text-slate-900 leading-snug">
                  Before fabrication starts
                </h2>
              </div>
              {orderLabel && (
                <p className="text-xs text-slate-500 font-semibold truncate">{orderLabel}</p>
              )}
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Installation deadline is required only when starting fabrication after design
                and quote are done.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Design checklist
            </p>

            <StepRow
              done={hasDesignProofs}
              title="1. Upload design proofs"
              detail={
                hasDesignProofs
                  ? "Design proofs are on the Design tab."
                  : "Upload customer-facing design proofs first."
              }
              action={
                !hasDesignProofs ? (
                  <button
                    type="button"
                    onClick={onGoToDesign}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Palette size={12} />
                    Open Design tab
                  </button>
                ) : undefined
              }
            />

            <StepRow
              done={isDesignApproved}
              title="2. Approve design"
              detail={
                isDesignApproved
                  ? "Design is approved (customer or admin)."
                  : "Wait for customer approval, or use Approve design (skip customer) on the Design tab."
              }
              action={
                !isDesignApproved ? (
                  <button
                    type="button"
                    onClick={onGoToDesign}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Palette size={12} />
                    Open Design tab
                  </button>
                ) : undefined
              }
            />

            <StepRow
              done={hasProductionFiles}
              title="3. Upload production files"
              detail={
                hasProductionFiles
                  ? "Final fabrication files are uploaded."
                  : "After design approval, upload production files (.cdr, .ai, .dxf, etc.) on the Design tab."
              }
              action={
                !hasProductionFiles ? (
                  <button
                    type="button"
                    onClick={onGoToDesign}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 mt-0.5 px-3 py-1.5 bg-white border border-amber-200 text-amber-900 rounded-lg text-[11px] font-bold hover:bg-amber-50 transition-colors disabled:opacity-50"
                  >
                    <FileUp size={12} />
                    Upload production files
                  </button>
                ) : undefined
              }
            />

            <div className="pt-2 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                4. Installation deadline
              </p>
              <div>
                <label
                  htmlFor="production-advance-install-deadline"
                  className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5"
                >
                  Installation deadline <span className="text-red-500">*</span>
                </label>
                <input
                  id="production-advance-install-deadline"
                  type="date"
                  value={deadline}
                  min={today}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setError(null);
                  }}
                  disabled={busy}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-60"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3.5 flex gap-2.5">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-blue-900">Production deadline</p>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Production deadline is one day before the installation deadline
                    {productionDeadline ? (
                      <>
                        {" "}
                        <span className="font-bold">{formatDisplayDate(productionDeadline)}</span>
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3.5 flex gap-2.5">
                <CreditCard size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-amber-900">Add payment (optional)</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Record an advance or milestone payment before fabrication if needed.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="px-4 md:px-6 py-3.5 md:py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void handleGoToPayments()}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {redirecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CreditCard size={14} />
              )}
              Open Payments
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy || !canContinue}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {confirming ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Confirm &amp; start fabrication
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
