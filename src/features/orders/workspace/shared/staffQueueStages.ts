import type { OrderStage } from "./types";

export type WorkflowType = "quote_first" | "design_first";

/** Canonical pipeline order for quote_first (default). */
export const PIPELINE_STAGE_ORDER = [
  "Site Visit Pending",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Quotation In Progress",
  "Quotation Sent",
  "Quotation Negotiation",
  "Quotation Approved",
  "Design In Progress",
  "Design Approved",
  "Production",
  "Ready For Installation",
  "Installation Scheduled",
  "Completed",
  "Closed",
] as const;

/** Canonical pipeline order for design_first. */
export const PIPELINE_STAGE_ORDER_DESIGN_FIRST = [
  "Site Visit Pending",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Design In Progress",
  "Design Approved",
  "Quotation In Progress",
  "Quotation Sent",
  "Quotation Negotiation",
  "Quotation Approved",
  "Production",
  "Ready For Installation",
  "Installation Scheduled",
  "Completed",
  "Closed",
] as const;

export function getPipelineStageOrder(workflowType?: WorkflowType) {
  return workflowType === "design_first" ? PIPELINE_STAGE_ORDER_DESIGN_FIRST : PIPELINE_STAGE_ORDER;
}

/** Orders actively being worked in this queue (default tab). */
const CURRENT_STAGES_BY_QUEUE: Record<OrderStage, readonly string[]> = {
  enquiry: [], // Not an order queue — dedicated /staff/enquiries list
  site_visit: ["Site Visit Pending", "Site Visit Scheduled", "Site Visit Completed"],
  quotation: [
    "Quotation In Progress",
    "Quotation Sent",
    "Quotation Negotiation",
    "Quotation Approved",
  ],
  invoice: [], // Not an order queue — dedicated /staff/invoices list
  design: ["Design In Progress", "Design Approved"],
  production: ["Production"],
  installation: ["Ready For Installation", "Installation Scheduled"],
  service_tickets: [], // Service tickets don't use order status pipeline
};

function stageIndex(stage: string, workflowType?: WorkflowType): number {
  const order = getPipelineStageOrder(workflowType);
  const idx = order.indexOf(stage as any);
  return idx === -1 ? -1 : idx;
}

function minCurrentIndex(entryStage: OrderStage, workflowType?: WorkflowType): number {
  const current = CURRENT_STAGES_BY_QUEUE[entryStage];
  if (current.length === 0) return -1;
  return Math.min(...current.map((s) => stageIndex(s, workflowType)));
}

function maxCurrentIndex(entryStage: OrderStage, workflowType?: WorkflowType): number {
  const current = CURRENT_STAGES_BY_QUEUE[entryStage];
  if (current.length === 0) return -1;
  return Math.max(...current.map((s) => stageIndex(s, workflowType)));
}

export function queueHasIncomingTab(entryStage: OrderStage): boolean {
  return entryStage !== "site_visit";
}

/** Orders that are in a stage BEFORE the current stages for this queue. */
export function isStaffQueueIncoming(stage: string, entryStage: OrderStage, workflowType?: WorkflowType): boolean {
  if (entryStage === "site_visit") return false;
  const idx = stageIndex(stage, workflowType);
  if (idx === -1) return false;
  return idx < minCurrentIndex(entryStage, workflowType);
}

/** @deprecated Use isStaffQueueIncoming */
export function isStaffQueueApproaching(stage: string, entryStage: OrderStage): boolean {
  return isStaffQueueIncoming(stage, entryStage);
}

/** Active in-phase work. */
export function isStaffQueueCurrent(stage: string, entryStage: OrderStage): boolean {
  return CURRENT_STAGES_BY_QUEUE[entryStage].includes(stage);
}

export function isStaffQueueCompleted(stage: string, entryStage: OrderStage, workflowType?: WorkflowType): boolean {
  const idx = stageIndex(stage, workflowType);
  if (idx === -1) return false;
  return idx > maxCurrentIndex(entryStage, workflowType);
}

export function isStaffQueueRelevant(stage: string, entryStage: OrderStage, workflowType?: WorkflowType): boolean {
  return (
    isStaffQueueIncoming(stage, entryStage, workflowType) ||
    isStaffQueueCurrent(stage, entryStage) ||
    isStaffQueueCompleted(stage, entryStage, workflowType)
  );
}

export type StaffQueueOrder = {
  stage?: string | null;
  assigned_employees?: string[] | null;
  workflow_type?: WorkflowType | null;
};

export type QueueView = "incoming" | "current" | "completed";

/** Assigned orders relevant to this queue (incoming + current + completed). */
export function filterStaffQueueOrders<T extends StaffQueueOrder>(
  orders: T[] | null | undefined,
  userId: string | undefined,
  entryStage: OrderStage,
  options?: { requireAssignment?: boolean }
): T[] {
  const requireAssignment = options?.requireAssignment !== false;
  return (orders ?? []).filter((o) => {
    if (requireAssignment && userId && !o.assigned_employees?.includes(userId)) {
      return false;
    }
    if (!requireAssignment && !o.stage) return false;
    return isStaffQueueRelevant(o.stage ?? "", entryStage, o.workflow_type as WorkflowType);
  });
}

/** Floor/kiosk portals: all orders relevant to queue (no assignment filter). */
export function filterFloorQueueOrders<T extends { stage?: string | null, workflow_type?: WorkflowType | null }>(
  orders: T[] | null | undefined,
  entryStage: OrderStage
): T[] {
  return (orders ?? []).filter((o) => isStaffQueueRelevant(o.stage ?? "", entryStage, o.workflow_type as WorkflowType));
}

export function partitionQueueOrdersByView<T extends { stage?: string | null, workflow_type?: WorkflowType | null }>(
  orders: T[],
  entryStage: OrderStage,
  view: QueueView
): T[] {
  return orders.filter((o) => {
    const stage = o.stage ?? "";
    const wt = o.workflow_type as WorkflowType;
    if (view === "incoming") return isStaffQueueIncoming(stage, entryStage, wt);
    if (view === "current") return isStaffQueueCurrent(stage, entryStage);
    return isStaffQueueCompleted(stage, entryStage, wt);
  });
}

export function countQueueViews<T extends { stage?: string | null, workflow_type?: WorkflowType | null }>(
  orders: T[],
  entryStage: OrderStage
): { incoming: number; current: number; completed: number } {
  return {
    incoming: partitionQueueOrdersByView(orders, entryStage, "incoming").length,
    current: partitionQueueOrdersByView(orders, entryStage, "current").length,
    completed: partitionQueueOrdersByView(orders, entryStage, "completed").length,
  };
}
