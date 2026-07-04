"use client";

import React from "react";

/**
 * Placeholder for the new Order Workspace activity panel.
 * Will eventually surface the order_activity audit trail.
 * Not yet connected to any order data or business logic.
 */
export const ActivityPanel: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
        Activity Panel
      </h3>
      <p className="text-xs text-slate-400 mt-1">Placeholder component</p>
    </div>
  );
};
