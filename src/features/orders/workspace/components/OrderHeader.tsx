"use client";

import React from "react";

/**
 * Placeholder for the new Order Workspace header.
 * Not yet connected to any order data or business logic.
 */
export const OrderHeader: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
      <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
        Order Header
      </h3>
      <p className="text-xs text-slate-400 mt-1">Placeholder component</p>
    </div>
  );
};
