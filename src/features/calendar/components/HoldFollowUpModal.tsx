"use client";

import React, { useState } from "react";
import { OverlayPortal } from "@/components/ui/OverlayPortal";

export interface HoldFollowUpPayload {
  note: string;
  reachOutAt: string;
}

interface HoldFollowUpModalProps {
  isOpen: boolean;
  entityLabel?: string;
  onClose: () => void;
  onSubmit: (payload: HoldFollowUpPayload) => void;
}

/** Collects required note + reach-out date when putting an order/enquiry On Hold. */
export function HoldFollowUpModal({
  isOpen,
  entityLabel = "item",
  onClose,
  onSubmit,
}: HoldFollowUpModalProps) {
  const [note, setNote] = useState("");
  const [reachOutAt, setReachOutAt] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setError("A note is required.");
      return;
    }
    if (!reachOutAt) {
      setError("Pick a date to reach out again.");
      return;
    }
    onSubmit({ note: trimmed, reachOutAt });
    setNote("");
    setReachOutAt("");
    setError("");
  };

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={onClose}
      >
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 bg-white shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <h2 className="m-0 text-base font-extrabold text-slate-900">Put on hold</h2>
          <p className="m-0 mt-1 text-xs text-slate-500">
            Add a note and the date you plan to reach out again. This {entityLabel} will appear
            on the calendar for that day.
          </p>

          <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why is this on hold?"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            autoFocus
          />

          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Reach out again on
          </label>
          <input
            type="date"
            value={reachOutAt}
            onChange={(e) => setReachOutAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {error ? <p className="m-0 mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
            >
              Confirm On Hold
            </button>
          </div>
        </form>
      </div>
    </OverlayPortal>
  );
}
