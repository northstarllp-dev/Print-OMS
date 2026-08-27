import type { OrderStage } from "./types";
import { isStageInOp } from "@/features/orders/businessOperations";
import type { BusinessStageKey } from "@/config/schema/businessOperations";

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
  "Customer Pickup",
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
  "Customer Pickup",
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
  installation: ["Ready For Installation", "Installation Scheduled", "Customer Pickup"],
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
  business_operation?: string | null;
};

function queueStageInBusinessOp(
  entryStage: OrderStage,
  businessOperation?: string | null
): boolean {
  // Mixed queue lists keep all stages unless the order declares an op that excludes this module.
  if (!businessOperation) return true;
  if (
    entryStage === "enquiry" ||
    entryStage === "invoice" ||
    entryStage === "service_tickets"
  ) {
    return true;
  }
  return isStageInOp(businessOperation, entryStage as BusinessStageKey);
}

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
    if (!queueStageInBusinessOp(entryStage, o.business_operation)) return false;
    return isStaffQueueRelevant(o.stage ?? "", entryStage, o.workflow_type as WorkflowType);
  });
}

/** Floor/kiosk portals: all orders relevant to queue (no assignment filter). */
export function filterFloorQueueOrders<T extends { stage?: string | null, workflow_type?: WorkflowType | null, business_operation?: string | null }>(
  orders: T[] | null | undefined,
  entryStage: OrderStage
): T[] {
  return (orders ?? []).filter((o) => {
    if (!queueStageInBusinessOp(entryStage, o.business_operation)) return false;
    return isStaffQueueRelevant(o.stage ?? "", entryStage, o.workflow_type as WorkflowType);
  });
}

export function partitionQueueOrdersByView<T extends { stage?: string | null, workflow_type?: WorkflowType | null, business_operation?: string | null }>(
  orders: T[],
  entryStage: OrderStage,
  view: QueueView
): T[] {
  return orders.filter((o) => {
    if (!queueStageInBusinessOp(entryStage, o.business_operation)) return false;
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

/** Pipeline stages that collapse into the unified My Orders queue. */
export const PIPELINE_QUEUE_STAGES = [
  "site_visit",
  "quotation",
  "design",
  "production",
  "installation",
] as const satisfies readonly OrderStage[];

export type PipelineQueueStage = (typeof PIPELINE_QUEUE_STAGES)[number];

export const MY_ORDERS_STAGE_LABELS: Record<PipelineQueueStage, string> = {
  site_visit: "Site Visit",
  quotation: "Quotation",
  design: "Design",
  production: "Production",
  installation: "Installation",
};

function isPipelineQueueStage(s: OrderStage): s is PipelineQueueStage {
  return (PIPELINE_QUEUE_STAGES as readonly string[]).includes(s);
}

/** Granted pipeline stages in pipeline order (RBAC-filtered). */
export function orderedMyOrdersStages(
  allowedStages: readonly OrderStage[]
): PipelineQueueStage[] {
  return PIPELINE_QUEUE_STAGES.filter((s) => allowedStages.includes(s));
}

function pipelineQueueIndex(stage: PipelineQueueStage): number {
  return PIPELINE_QUEUE_STAGES.indexOf(stage);
}

/** True when two consecutive grants skip one or more pipeline stages. */
export function myOrdersHasPipelineGaps(allowedStages: readonly OrderStage[]): boolean {
  const ordered = orderedMyOrdersStages(allowedStages);
  for (let i = 0; i < ordered.length - 1; i++) {
    if (pipelineQueueIndex(ordered[i + 1]) - pipelineQueueIndex(ordered[i]) > 1) {
      return true;
    }
  }
  return false;
}

export type MyOrdersTab = "all" | "incoming" | PipelineQueueStage | "completed";

/**
 * Incoming tab when:
 * - earliest editable stage is after site_visit (classic pre-stage Incoming), or
 * - grants skip pipeline stages (gap Incoming between Site Visit → Production, etc.).
 */
export function myOrdersHasIncomingTab(allowedStages: readonly OrderStage[]): boolean {
  const ordered = orderedMyOrdersStages(allowedStages);
  if (ordered.length === 0) return false;
  return queueHasIncomingTab(ordered[0]) || myOrdersHasPipelineGaps(ordered);
}

/**
 * Tab strip order: All first; then classic Incoming; otherwise Incoming inserted after the
 * stage that precedes the first pipeline gap (e.g. All | Site Visit | Incoming | Production).
 */
export function buildMyOrdersTabList(
  allowedStages: readonly OrderStage[]
): MyOrdersTab[] {
  const ordered = orderedMyOrdersStages(allowedStages);
  if (ordered.length === 0) return [];

  const tabs: MyOrdersTab[] = ["all"];
  const classicIncoming = queueHasIncomingTab(ordered[0]);
  if (classicIncoming) tabs.push("incoming");

  let gapIncomingInserted = false;
  for (let i = 0; i < ordered.length; i++) {
    tabs.push(ordered[i]);
    if (
      !classicIncoming &&
      !gapIncomingInserted &&
      i < ordered.length - 1 &&
      pipelineQueueIndex(ordered[i + 1]) - pipelineQueueIndex(ordered[i]) > 1
    ) {
      tabs.push("incoming");
      gapIncomingInserted = true;
    }
  }
  tabs.push("completed");
  return tabs;
}
export function parseMyOrdersTab(
  value: string | null | undefined,
  allowedStages: readonly OrderStage[]
): MyOrdersTab | undefined {
  if (!value) return undefined;
  if (value === "all") return "all";
  if (value === "incoming") {
    return myOrdersHasIncomingTab(allowedStages) ? "incoming" : undefined;
  }
  if (value === "completed") return "completed";
  if (isPipelineQueueStage(value as OrderStage) && allowedStages.includes(value as OrderStage)) {
    return value as PipelineQueueStage;
  }
  return undefined;
}

/**
 * Approaching work: before any editable stage's current band, and not already
 * in a current band or past the latest editable stage.
 * Covers classic pre-stage Incoming and gap stages between non-contiguous grants.
 */
export function isMyOrdersIncoming(
  stage: string,
  allowedStages: readonly OrderStage[],
  workflowType?: WorkflowType
): boolean {
  const ordered = orderedMyOrdersStages(allowedStages);
  if (ordered.length === 0) return false;
  if (ordered.some((s) => isStaffQueueCurrent(stage, s))) return false;
  if (isMyOrdersCompleted(stage, ordered, workflowType)) return false;

  const idx = stageIndex(stage, workflowType);
  if (idx === -1) return false;

  return ordered.some((s) => {
    const min = minCurrentIndex(s, workflowType);
    return min >= 0 && idx < min;
  });
}

/** Past work: after latest editable stage, not already in a current band. */
export function isMyOrdersCompleted(
  stage: string,
  allowedStages: readonly OrderStage[],
  workflowType?: WorkflowType
): boolean {
  const ordered = orderedMyOrdersStages(allowedStages);
  if (ordered.length === 0) return false;
  if (ordered.some((s) => isStaffQueueCurrent(stage, s))) return false;
  return isStaffQueueCompleted(stage, ordered[ordered.length - 1], workflowType);
}

export function isMyOrdersRelevant(
  stage: string,
  allowedStages: readonly OrderStage[],
  workflowType?: WorkflowType
): boolean {
  const ordered = orderedMyOrdersStages(allowedStages);
  if (ordered.length === 0) return false;
  return (
    ordered.some((s) => isStaffQueueCurrent(stage, s)) ||
    isMyOrdersIncoming(stage, ordered, workflowType) ||
    isMyOrdersCompleted(stage, ordered, workflowType)
  );
}

/** Assigned orders in Incoming / Current bands / Completed for the actor's grants. */
export function filterMyOrdersAssigned<T extends StaffQueueOrder>(
  orders: T[] | null | undefined,
  userId: string | undefined,
  allowedStages: readonly OrderStage[]
): T[] {
  const stages = orderedMyOrdersStages(allowedStages);
  return (orders ?? []).filter((o) => {
    if (userId && !o.assigned_employees?.includes(userId)) return false;
    return isMyOrdersRelevant(
      o.stage ?? "",
      stages,
      o.workflow_type as WorkflowType
    );
  });
}

/** Orders currently in the given module stage band. */
export function partitionMyOrdersByStage<T extends { stage?: string | null }>(
  orders: T[],
  stage: OrderStage
): T[] {
  return orders.filter((o) => isStaffQueueCurrent(o.stage ?? "", stage));
}

export function partitionMyOrdersByTab<
  T extends { stage?: string | null; workflow_type?: WorkflowType | null },
>(orders: T[], tab: MyOrdersTab, allowedStages: readonly OrderStage[]): T[] {
  if (tab === "all") return orders;
  if (tab === "incoming") {
    return orders.filter((o) =>
      isMyOrdersIncoming(o.stage ?? "", allowedStages, o.workflow_type as WorkflowType)
    );
  }
  if (tab === "completed") {
    return orders.filter((o) =>
      isMyOrdersCompleted(o.stage ?? "", allowedStages, o.workflow_type as WorkflowType)
    );
  }
  return partitionMyOrdersByStage(orders, tab);
}

export type MyOrdersTabCounts = {
  all: number;
  incoming: number;
  completed: number;
} & Partial<Record<OrderStage, number>>;

export function countMyOrdersTabs<
  T extends { stage?: string | null; workflow_type?: WorkflowType | null },
>(orders: T[], allowedStages: readonly OrderStage[]): MyOrdersTabCounts {
  const stages = orderedMyOrdersStages(allowedStages);
  const counts: MyOrdersTabCounts = {
    all: orders.length,
    incoming: partitionMyOrdersByTab(orders, "incoming", stages).length,
    completed: partitionMyOrdersByTab(orders, "completed", stages).length,
  };
  for (const s of stages) {
    counts[s] = partitionMyOrdersByStage(orders, s).length;
  }
  return counts;
}

/** @deprecated Prefer countMyOrdersTabs */
export function countMyOrdersByStage<T extends { stage?: string | null }>(
  orders: T[],
  stages: readonly OrderStage[]
): Partial<Record<OrderStage, number>> {
  const counts: Partial<Record<OrderStage, number>> = {};
  for (const s of stages) {
    counts[s] = partitionMyOrdersByStage(orders, s).length;
  }
  return counts;
}

/** Default tab: All assigned orders (stage tabs remain available as filters). */
export function defaultMyOrdersTab(
  allowedStages: readonly OrderStage[],
  _counts?: MyOrdersTabCounts
): MyOrdersTab | undefined {
  const stages = orderedMyOrdersStages(allowedStages);
  if (stages.length === 0) return undefined;
  return "all";
}

/** @deprecated Prefer defaultMyOrdersTab */
export function defaultMyOrdersStage(
  allowedStages: readonly OrderStage[],
  counts: Partial<Record<OrderStage, number>>
): OrderStage | undefined {
  const stages = orderedMyOrdersStages(allowedStages);
  if (stages.length === 0) return undefined;
  const withOrders = stages.find((s) => (counts[s] ?? 0) > 0);
  return withOrders ?? stages[0];
}
