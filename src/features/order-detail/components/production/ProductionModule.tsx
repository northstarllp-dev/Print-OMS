"use client";

import React, { useEffect, useState } from "react";
import { CheckSquare } from "lucide-react";
import { Order, ProductionDetails } from "@/types";
import { getAppSettings } from "@/features/settings/actions/settingsActions";
import {
  buildProductionChecklistUpdate,
  DEFAULT_PRODUCTION_CHECKLIST_ITEMS,
  readCustomProductionChecklistItems,
  resolveChecklistProgress,
  type ProductionChecklistItem,
} from "@/features/settings/productionChecklist";

interface ProductionModuleProps {
  order: Order;
  isEmployee: boolean;
  isReadOnly?: boolean;
  updateProductionDetails: (orderId: string, details: Partial<ProductionDetails>) => Promise<void>;
}

export const ProductionModule: React.FC<ProductionModuleProps> = ({
  order,
  isEmployee,
  isReadOnly = false,
  updateProductionDetails,
}) => {
  const [items, setItems] = useState<ProductionChecklistItem[]>(DEFAULT_PRODUCTION_CHECKLIST_ITEMS);
  const pd = (order.productionDetails || {}) as Record<string, unknown>;
  const progress = resolveChecklistProgress(pd, items);

  useEffect(() => {
    getAppSettings()
      .then((settings) => {
        if (settings?.productionChecklistItems?.length) {
          setItems(settings.productionChecklistItems);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Workshop Production Queue
        </h3>
        <span className="text-[10px] font-bold text-slate-400">STAGE 4</span>
      </div>

      <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
        <p className="text-xs text-slate-500 leading-normal">
          Check off critical milestones in the signage assembly pipeline. Fabricators must confirm
          structural tests before shipping.
        </p>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white shadow-xs">
          {items.map((item, index) => {
            const checked = !!progress[item.id];
            return (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <CheckSquare
                    size={16}
                    className={`mr-3 ${checked ? "text-emerald-600" : "text-slate-300"}`}
                  />
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                    {index + 1}. {item.label}
                    {item.required === false && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Optional
                      </span>
                    )}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = { ...progress, [item.id]: !checked };
                    for (const custom of readCustomProductionChecklistItems(pd)) {
                      next[custom.id] = custom.checked;
                    }
                    const customMeta = readCustomProductionChecklistItems(pd).map(
                      ({ id, label }) => ({ id, label })
                    );
                    updateProductionDetails(
                      order.id,
                      buildProductionChecklistUpdate(
                        next,
                        items,
                        {},
                        customMeta
                      ) as Partial<ProductionDetails>
                    );
                  }}
                  disabled={isReadOnly || (isEmployee && order.stageStatus?.includes("Pending"))}
                  className="w-4.5 h-4.5 rounded text-emerald-600 cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
