"use client";

import React, { useMemo } from "react";
import type { OrderStage } from "@/features/orders/workspace/shared/types";
import {
  buildMyOrdersTabList,
  MY_ORDERS_STAGE_LABELS,
  type MyOrdersTab,
  type MyOrdersTabCounts,
  type PipelineQueueStage,
} from "@/features/orders/workspace/shared/staffQueueStages";

interface MyOrdersStageTabsProps {
  stages: readonly OrderStage[];
  value: MyOrdersTab;
  onChange: (tab: MyOrdersTab) => void;
  counts: MyOrdersTabCounts;
}

export function MyOrdersStageTabs({
  stages,
  value,
  onChange,
  counts,
}: MyOrdersStageTabsProps) {
  const tabs = useMemo(() => {
    return buildMyOrdersTabList(stages).map((id) => {
      if (id === "incoming") {
        return { id, label: "Incoming", count: counts.incoming ?? 0 };
      }
      if (id === "completed") {
        return { id, label: "Completed", count: counts.completed ?? 0 };
      }
      return {
        id,
        label: MY_ORDERS_STAGE_LABELS[id as PipelineQueueStage],
        count: counts[id] ?? 0,
      };
    });
  }, [stages, counts]);

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl max-w-full overflow-x-auto"
      role="tablist"
      aria-label="Order stages"
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
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
              active
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span
              className={`min-w-[1.25rem] px-1.5 py-0.5 text-[10px] font-black rounded-md ${
                active ? "bg-blue-50 text-blue-700" : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
