"use client";

import React from "react";
import { OrderHeader } from "./components/OrderHeader";
import { WorkflowTimeline } from "./components/WorkflowTimeline";
import { ModuleRenderer } from "./components/ModuleRenderer";
import { ActivityPanel } from "./components/ActivityPanel";
import type { OrderStage } from "./shared/types";

/**
 * OrderWorkspace composes the new order workspace architecture.
 * This is a purely structural placeholder — it is not wired up to any
 * routes, data, or business logic yet.
 */
export const OrderWorkspace: React.FC = () => {
  const selectedStage: OrderStage = "site_visit";

  return (
    <div className="space-y-6 max-w-none">
      <OrderHeader />
      <WorkflowTimeline />
      <ModuleRenderer selectedStage={selectedStage} />
      <ActivityPanel />
    </div>
  );
};
