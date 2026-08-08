/** Pure order list / KPI / health / detail helpers (unit-tested). */

import type { OrderHealth } from "@/features/orders/lib/orderHealth";
import { ORDER_HEALTH_VALUES, isOrderHealth } from "@/features/orders/lib/orderHealth";

export { ORDER_HEALTH_VALUES, isOrderHealth };
export type { OrderHealth };

export interface OrderListRow {
  id: string;
  orderId?: string | null;
  orderCode?: string | null;
  clientName?: string | null;
  businessName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  stage?: string | null;
  stageStatus?: string | null;
  health?: string | null;
  lost_reason?: string | null;
  dateCreated?: string | null;
  assignedEmployees?: string[] | null;
  assignedAdmins?: string[] | null;
  workflow_type?: "quote_first" | "design_first" | null;
  business_operation?: string | null;
  company_id?: string | null;
}

export interface OrderCustomerLookup {
  id: string;
  name?: string | null;
  phone?: string | null;
}

export interface OrderFilterOptions {
  search?: string;
  stageFilter?: string;
  healthFilter?: string;
  selectedKpi?: string | null;
  dateFilterType?: "range" | "all";
  startDate?: string;
  endDate?: string;
  /** Admin "My assignments" filter */
  adminAssignedFilter?: "ALL" | "MINE";
  currentUserId?: string | null;
  /** Employee list: only orders assigned to this employee */
  userRole?: "Admin" | "Employee";
  employeeId?: string | null;
  employeeName?: string | null;
  customers?: OrderCustomerLookup[];
}

/** Map DB / page-mapped order → table view shape. */
export function mapDbOrderToListRow(o: Record<string, any>): OrderListRow {
  return {
    id: o.id,
    clientName: o.client_name ?? o.clientName,
    businessName: o.business_name ?? o.businessName ?? "",
    customerId: o.customer_id ?? o.customerId,
    stage: o.stage,
    stageStatus: o.stage_status ?? o.stageStatus ?? "Normal",
    health: o.health || "Active",
    lost_reason: o.lost_reason ?? o.lostReason ?? null,
    assignedEmployees: o.assigned_employees ?? o.assignedEmployees ?? [],
    assignedAdmins: o.assigned_admins ?? o.assignedAdmins ?? [],
    dateCreated: o.date_created ?? o.dateCreated,
    customerName: o.business_name ?? o.businessName ?? o.customerName ?? "",
    orderCode: o.order_id ?? o.orderCode ?? o.id,
    orderId: o.order_id ?? o.orderId ?? o.id,
    workflow_type: o.workflow_type ?? "quote_first",
    business_operation: o.business_operation ?? "signage",
    company_id: o.company_id ?? o.companyId ?? null,
  };
}

export function normalizeOrderHealth(health?: string | null): string {
  return health || "Active";
}

export function needsAdminApproval(stageStatus?: string | null): boolean {
  return (
    !!stageStatus &&
    stageStatus !== "Normal" &&
    stageStatus.startsWith("Pending Admin Approval")
  );
}

export function isTerminalOrderStage(stage?: string | null): boolean {
  return stage === "Completed" || stage === "Closed";
}

/** Service tickets are only created from finished orders. */
export function canShowAddServiceTicketForOrder(stage?: string | null): boolean {
  return isTerminalOrderStage(stage);
}

/** Health is meaningful only while the order is still in the pipeline. */
export function canChangeOrderHealth(stage?: string | null): boolean {
  return !isTerminalOrderStage(stage);
}

export function isActivePipelineOrder(order: { stage?: string | null }): boolean {
  return !isTerminalOrderStage(order.stage);
}

export function isUnassignedActiveOrder(order: {
  stage?: string | null;
  assignedEmployees?: string[] | null;
}): boolean {
  return (
    isActivePipelineOrder(order) &&
    (!order.assignedEmployees || order.assignedEmployees.length === 0)
  );
}

/** Quick health transitions from the row ⋯ menu (admin). */
export function healthMenuActions(
  health?: string | null
): Array<{ health: OrderHealth; label: string }> {
  const h = normalizeOrderHealth(health);
  if (h === "Needs Attention") {
    return [
      { health: "Active", label: "Make Active" },
      { health: "On Hold", label: "On Hold" },
      { health: "Lost", label: "Mark as Lost" },
    ];
  }
  if (h === "On Hold") {
    return [
      { health: "Active", label: "Make Active" },
      { health: "Lost", label: "Mark as Lost" },
    ];
  }
  if (h === "Lost") {
    return [{ health: "Active", label: "Reopen (Active)" }];
  }
  return [
    { health: "On Hold", label: "On Hold" },
    { health: "Lost", label: "Mark as Lost" },
  ];
}

export function isAllowedHealthTransition(
  from: string | null | undefined,
  to: string
): boolean {
  return healthMenuActions(from).some((a) => a.health === to);
}

export function buildHealthUpdatePayload(
  health: string,
  lostReason?: string | null,
  hold?: { note?: string | null; reachOutAt?: string | null } | null
): {
  health: string;
  lost_reason: string | null;
  hold_note: string | null;
  reach_out_at: string | null;
} {
  const isHold = health === "On Hold";
  return {
    health,
    lost_reason: health === "Lost" ? lostReason ?? null : null,
    hold_note: isHold ? hold?.note?.trim() || null : null,
    reach_out_at: isHold ? hold?.reachOutAt || null : null,
  };
}

export function requiresHoldFollowUpPrompt(health: string): boolean {
  return health === "On Hold";
}

export function isValidHoldFollowUp(note?: string | null, reachOutAt?: string | null): boolean {
  return Boolean(note?.trim() && reachOutAt);
}

export function requiresLostReasonPrompt(
  health: string,
  promptReason: string | undefined
): boolean {
  return health === "Lost" && promptReason === undefined;
}

export function isValidLostReason(reason?: string | null): boolean {
  return Boolean(reason && reason.trim());
}

export function matchesStageGroup(stage: string, stageFilter: string): boolean {
  if (stageFilter === "ALL") return true;
  if (stageFilter === "Site Visit") return stage.includes("Site Visit");
  if (stageFilter === "Quotation") return stage.includes("Quotation");
  if (stageFilter === "Designing") return stage.includes("Design");
  if (stageFilter === "Production") return stage === "Production";
  if (stageFilter === "Installation") return stage.includes("Installation");
  if (stageFilter === "Completed") return isTerminalOrderStage(stage);
  return true;
}

export function filterOrders<T extends OrderListRow>(
  orders: T[],
  opts: OrderFilterOptions
): T[] {
  const search = (opts.search || "").trim().toLowerCase();
  const stageFilter = opts.stageFilter ?? "ALL";
  const healthFilter = opts.healthFilter ?? "ALL";
  const selectedKpi = opts.selectedKpi ?? null;
  const dateFilterType = opts.dateFilterType ?? "range";
  const startDate = opts.startDate || "";
  const endDate = opts.endDate || "";
  const customers = opts.customers ?? [];

  return orders.filter((order) => {
    if (search) {
      const cust = customers.find((c) => c.id === order.customerId);
      const custName = (cust?.name || order.customerName || "").toLowerCase();
      const matches =
        (order.clientName || "").toLowerCase().includes(search) ||
        (order.businessName || "").toLowerCase().includes(search) ||
        (order.orderCode || order.orderId || order.id || "")
          .toLowerCase()
          .includes(search) ||
        custName.includes(search);
      if (!matches) return false;
    }

    if (dateFilterType === "range") {
      const orderDate = order.dateCreated
        ? new Date(order.dateCreated).toISOString().split("T")[0]
        : null;
      if (!orderDate) return false;
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
    }

    if (!matchesStageGroup(order.stage || "", stageFilter)) return false;

    if (healthFilter !== "ALL" && normalizeOrderHealth(order.health) !== healthFilter) {
      return false;
    }

    if (opts.userRole === "Employee") {
      const empId = opts.employeeId;
      const empName = opts.employeeName;
      const assigned = order.assignedEmployees || [];
      if (
        !(empName && assigned.includes(empName)) &&
        !(empId && assigned.includes(empId))
      ) {
        return false;
      }
    }

    if (opts.userRole !== "Employee" && opts.adminAssignedFilter === "MINE") {
      if (!opts.currentUserId) return false;
      if (!order.assignedAdmins?.includes(opts.currentUserId)) return false;
    }

    if (selectedKpi === "active" && !isActivePipelineOrder(order)) return false;
    if (selectedKpi === "unassigned" && !isUnassignedActiveOrder(order)) return false;
    if (selectedKpi === "approvals" && !needsAdminApproval(order.stageStatus)) return false;
    if (selectedKpi === "completed" && !isTerminalOrderStage(order.stage)) return false;

    return true;
  });
}

export function computeOrderKpis(orders: OrderListRow[]) {
  return {
    active: orders.filter(isActivePipelineOrder).length,
    unassigned: orders.filter(isUnassignedActiveOrder).length,
    approvals: orders.filter((o) => needsAdminApproval(o.stageStatus)).length,
    completed: orders.filter((o) => isTerminalOrderStage(o.stage)).length,
  };
}

export function countActiveOrderFilters(opts: {
  stageFilter?: string;
  healthFilter?: string;
  startDate?: string;
  endDate?: string;
  adminAssignedFilter?: "ALL" | "MINE";
  enableAdminAssignment?: boolean;
  selectedKpi?: string | null;
}): number {
  return [
    (opts.stageFilter ?? "ALL") !== "ALL",
    (opts.healthFilter ?? "ALL") !== "ALL",
    Boolean(opts.startDate || opts.endDate),
    Boolean(opts.enableAdminAssignment && opts.adminAssignedFilter === "MINE"),
    Boolean(opts.selectedKpi),
  ].filter(Boolean).length;
}

export function sortOrdersByDateCreated<T extends OrderListRow>(
  orders: T[],
  ascending = false
): T[] {
  return [...orders].sort((a, b) => {
    const ta = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
    const tb = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
    return ascending ? ta - tb : tb - ta;
  });
}

/** Client-side page slice (UI may paginate later; logic is pure). */
export function paginateOrders<T>(
  orders: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const size = Math.max(1, Math.floor(pageSize));
  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * size;
  return {
    items: orders.slice(start, start + size),
    total,
    page: safePage,
    pageSize: size,
    totalPages,
  };
}

export function isOrdersEmptyState(orders: unknown[] | null | undefined): boolean {
  return !orders || orders.length === 0;
}

export function isOrdersLoadingState(loading: boolean, hasData: boolean): boolean {
  return loading && !hasData;
}

export function resolveOrderDetailHref(input: {
  orderId?: string | null;
  id: string;
  userRole: "Admin" | "Employee";
  orderDetailBasePath?: string;
  entryStage?: string | null;
}): string {
  const basePath =
    input.orderDetailBasePath ??
    (input.userRole === "Admin" ? "/admin/orders" : "/staff/orders");
  const base = `${basePath}/${input.orderId || input.id}`;
  return input.entryStage ? `${base}?entryStage=${input.entryStage}` : base;
}

/** Preset payload when "Add Service Ticket" is clicked from an order row. */
export function buildServiceTicketPreset(input: {
  order: {
    id: string;
    orderId?: string | null;
    orderCode?: string | null;
    customerId?: string | null;
    clientName?: string | null;
    businessName?: string | null;
  };
  customerPhone?: string | null;
}): {
  phone: string;
  customerId: string;
  orderId: string;
  orderLabel: string;
} {
  const code =
    input.order.orderCode || input.order.orderId || input.order.id;
  const name =
    input.order.clientName || input.order.businessName || "Order";
  return {
    phone: input.customerPhone || "",
    customerId: input.order.customerId || "",
    orderId: input.order.id,
    orderLabel: `${code} - ${name}`,
  };
}

/** createServiceTicketAction insert shape (company from logged-in profile). */
export function buildServiceTicketCreatePayload(input: {
  companyId: string;
  customerId: string;
  orderId: string;
  phone: string;
  description: string;
  createdBy: string;
  photos?: unknown[];
  resolutionNotes?: string | null;
}): {
  company_id: string;
  customer_id: string;
  order_id: string;
  phone: string;
  description: string;
  photos: unknown[];
  resolution_notes: string | null;
  source: "admin";
  status: "open";
  created_by: string;
} {
  return {
    company_id: input.companyId,
    customer_id: input.customerId,
    order_id: input.orderId,
    phone: input.phone.replace(/\s+/g, "").trim(),
    description: input.description.trim(),
    photos: Array.isArray(input.photos) ? input.photos : [],
    resolution_notes: input.resolutionNotes?.trim() || null,
    source: "admin",
    status: "open",
    created_by: input.createdBy,
  };
}

export function resolveWriteCompanyIdPreference(input: {
  profileCompanyId?: string | null;
  deployCompanyId?: string | null;
}): string {
  if (input.profileCompanyId) return input.profileCompanyId;
  if (input.deployCompanyId) return input.deployCompanyId;
  throw new Error("Company context missing");
}

/** Multi-tenant: activity / ticket / order rows must match deploy company. */
export function assertSameCompany(
  rowCompanyId: string | null | undefined,
  expectedCompanyId: string
): boolean {
  return Boolean(rowCompanyId && rowCompanyId === expectedCompanyId);
}

export function canListOrders(actor: {
  role: string;
  canView?: boolean;
  canEdit?: boolean;
}): boolean {
  if (actor.role === "admin" || actor.role === "Admin") return true;
  return Boolean(actor.canView || actor.canEdit);
}

export function canManageOrderHealth(actor: { role: string }): boolean {
  return actor.role === "admin" || actor.role === "Admin";
}

export function createOrderDefaults(companyId: string, formData: Record<string, unknown>) {
  if (!companyId) throw new Error("company_id is required");
  return {
    company_id: companyId,
    ...formData,
    health: (formData.health as string) || "Active",
  };
}

export function validateOrderCreateInput(input: {
  company_id?: string | null;
  customer_id?: string | null;
  stage?: string | null;
  workflow_type?: string | null;
}): string[] {
  const errors: string[] = [];
  if (!input.company_id) errors.push("company_id is required");
  if (!input.customer_id) errors.push("customer_id is required");
  if (
    input.workflow_type &&
    input.workflow_type !== "quote_first" &&
    input.workflow_type !== "design_first"
  ) {
    errors.push("invalid workflow_type");
  }
  return errors;
}

/** Soft-delete is not used for orders today — delete is hard. */
export function orderDeleteMode(): "hard" {
  return "hard";
}

export function stallCutoffIso(days: number, from: Date = new Date()): string {
  const cutoff = new Date(from);
  cutoff.setDate(cutoff.getDate() - Math.max(0, days));
  return cutoff.toISOString();
}

export function isOrderStalledCandidate(
  o: {
    health?: string | null;
    stage?: string | null;
    stage_changed_at?: string | null;
  },
  cutoffIso: string
): boolean {
  if (normalizeOrderHealth(o.health) !== "Active") return false;
  if (isTerminalOrderStage(o.stage)) return false;
  if (!o.stage_changed_at) return false;
  return o.stage_changed_at <= cutoffIso;
}
