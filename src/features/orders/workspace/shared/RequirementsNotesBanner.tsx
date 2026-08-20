"use client";

import React from "react";
import { StickyNote } from "lucide-react";

/** Shows enquiry/order requirements on every workflow stage. */
export function RequirementsNotesBanner({
  requirements,
}: {
  requirements?: string | null;
}) {
  const text = (requirements || "").trim();
  if (!text) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <StickyNote size={15} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-amber-800 mb-0.5">
            Requirements
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
