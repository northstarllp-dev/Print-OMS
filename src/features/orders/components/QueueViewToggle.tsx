"use client";

import React from "react";
import type { QueueView } from "@/features/orders/workspace/shared/staffQueueStages";

export type { QueueView };

interface QueueViewToggleProps {
  value: QueueView;
  onChange: (view: QueueView) => void;
  incomingCount?: number;
  currentCount?: number;
  completedCount?: number;
}

export function QueueViewToggle({
  value,
  onChange,
  incomingCount,
  currentCount,
  completedCount,
}: QueueViewToggleProps) {
  const tabs: { id: QueueView; label: string; count?: number }[] = [
    { id: "incoming", label: "Incoming", count: incomingCount },
    { id: "current", label: "Current", count: currentCount },
    { id: "completed", label: "Completed", count: completedCount },
  ];

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl"
      role="tablist"
      aria-label="Queue view"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              active
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`min-w-[1.25rem] px-1.5 py-0.5 text-[10px] font-black rounded-md ${
                  active ? "bg-blue-50 text-blue-700" : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
