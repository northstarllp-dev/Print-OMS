import type { OrderStage } from "./types";

/** Canonical pipeline order for queue partitioning. */
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

/** Orders actively being worked in this queue (default tab). */
const CURRENT_STAGES_BY_QUEUE: Record<OrderStage, readonly string[]> = {
  site_visit: ["Site Visit Scheduled", "Site Visit Completed"],
  quotation: [
    "Quotation In Progress",
    "Quotation Sent",
    "Quotation Negotiation",
    "Quotation Approved",
  ],
  design: ["Design In Progress", "Design Approved"],
  production: ["Production", "Ready For Installation"],
  installation: ["Installation Scheduled"],
};

/** Orders entering this queue — assigned but not yet in active work stages. */
const APPROACHING_STAGES_BY_QUEUE: Record<OrderStage, readonly string[]> = {
  site_visit: ["Site Visit Pending"],
  quotation: ["Site Visit Completed"],
  design: ["Quotation Approved"],
  production: ["Design Approved"],
  installation: ["Ready For Installation"],
};

function stageIndex(stage: string): number {
  const idx = PIPELINE_STAGE_ORDER.indexOf(stage as (typeof PIPELINE_STAGE_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

function maxCurrentIndex(entryStage: OrderStage): number {
  const current = CURRENT_STAGES_BY_QUEUE[entryStage];
  return Math.max(...current.map((s) => stageIndex(s)));
}

export function isStaffQueueApproaching(stage: string, entryStage: OrderStage): boolean {
  return APPROACHING_STAGES_BY_QUEUE[entryStage].includes(stage);
}

/** Active in-phase work (formerly the single "incoming" bucket). */
export function isStaffQueueCurrent(stage: string, entryStage: OrderStage): boolean {
  return CURRENT_STAGES_BY_QUEUE[entryStage].includes(stage);
}

/** @deprecated Use isStaffQueueApproaching or isStaffQueueCurrent */
export function isStaffQueueIncoming(stage: string, entryStage: OrderStage): boolean {
  return isStaffQueueApproaching(stage, entryStage) || isStaffQueueCurrent(stage, entryStage);
}

export function isStaffQueueCompleted(stage: string, entryStage: OrderStage): boolean {
  const idx = stageIndex(stage);
  if (idx === -1) return false;
  return idx > maxCurrentIndex(entryStage);
}

export function isStaffQueueRelevant(stage: string, entryStage: OrderStage): boolean {
  return (
    isStaffQueueApproaching(stage, entryStage) ||
    isStaffQueueCurrent(stage, entryStage) ||
    isStaffQueueCompleted(stage, entryStage)
  );
}

export type StaffQueueOrder = {
  stage?: string | null;
  assigned_employees?: string[] | null;
};

export type QueueView = "incoming" | "current" | "completed";

/** Assigned orders relevant to this queue (approaching + current + completed). */
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
    return isStaffQueueRelevant(o.stage ?? "", entryStage);
  });
}

/** Floor/kiosk portals: all orders relevant to queue (no assignment filter). */
export function filterFloorQueueOrders<T extends { stage?: string | null }>(
  orders: T[] | null | undefined,
  entryStage: OrderStage
): T[] {
  return (orders ?? []).filter((o) => isStaffQueueRelevant(o.stage ?? "", entryStage));
}

export function partitionQueueOrdersByView<T extends { stage?: string | null }>(
  orders: T[],
  entryStage: OrderStage,
  view: QueueView
): T[] {
  return orders.filter((o) => {
    const stage = o.stage ?? "";
    if (view === "incoming") return isStaffQueueApproaching(stage, entryStage);
    if (view === "current") return isStaffQueueCurrent(stage, entryStage);
    return isStaffQueueCompleted(stage, entryStage);
  });
}

export function countQueueViews<T extends { stage?: string | null }>(
  orders: T[],
  entryStage: OrderStage
): { incoming: number; current: number; completed: number } {
  return {
    incoming: partitionQueueOrdersByView(orders, entryStage, "incoming").length,
    current: partitionQueueOrdersByView(orders, entryStage, "current").length,
    completed: partitionQueueOrdersByView(orders, entryStage, "completed").length,
  };
}
