"use client";

import React from "react";
import type { ComponentType } from "react";
import type { OrderStage } from "./types";
import { SiteVisitModule } from "../modules/site-visit/SiteVisitModule";
import { QuotationModule } from "../modules/quotation/QuotationModule";
import { DesignModule } from "../modules/design/DesignModule";
import { InstallationModule } from "../modules/installation/InstallationModule";

/**
 * Registry stub for production until ModuleRenderer passes workspace props
 * into the real ProductionModule at ../modules/production/ProductionModule.tsx.
 */
const ProductionStageStub: React.FC = () => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
      Production Module
    </h3>
    <p className="text-xs text-slate-400 mt-1">Placeholder component</p>
  </div>
);

/** Placeholder registry modules have heterogeneous props; ModuleRenderer is not wired to production yet. */
export const stageModules: Record<OrderStage, ComponentType<any>> = {
  enquiry: () => null,
  site_visit: SiteVisitModule,
  quotation: QuotationModule,
  invoice: () => null,
  design: DesignModule,
  production: ProductionStageStub,
  installation: InstallationModule,
  service_tickets: () => null,
};
