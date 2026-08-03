import type { OrderStage, StageActor, StagePermission } from "./types";
import type { RoleStageGrantMapConfig } from "@/config/schema";
import { clientRegistry } from "@/config/registry";
import { mergeConfig } from "@/config/mergeConfig";
import { loadClientConfig } from "@/config/loadClientConfig";
import { PIPELINE_QUEUE_STAGES } from "./staffQueueStages";

export { PIPELINE_QUEUE_STAGES };

function isPipelineNavStage(s: OrderStage): boolean {
  return (PIPELINE_QUEUE_STAGES as readonly string[]).includes(s);
}

export type RoleStageGrantMap = Partial<Record<OrderStage, StagePermission>>;

/** Sugar for "edit-only on these stages" (implies canView too). */
function edit(...stages: OrderStage[]): RoleStageGrantMap {
  const map: RoleStageGrantMap = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
}

/**
 * Default stage grants by staff_role. Used when no tenant-specific override
 * exists for the actor's company_id.
 */
export const DEFAULT_STAGE_GRANTS_BY_ROLE: Record<string, RoleStageGrantMap> = {
  Production: edit("production", "service_tickets"),
  Installation: edit("site_visit", "installation"),
  Designer: edit("site_visit", "design"),
  Marketer: edit("enquiry", "site_visit", "quotation", "invoice"),
};

function toRoleMap(
  cfg?: RoleStageGrantMapConfig
): RoleStageGrantMap | undefined {
  if (!cfg) return undefined;
  return cfg as RoleStageGrantMap;
}

/** company_id → staff_role → grant map, built from all registered clients */
function buildTenantRoleGrants(): Record<string, Record<string, RoleStageGrantMap>> {
  const out: Record<string, Record<string, RoleStageGrantMap>> = {};
  for (const partial of Object.values(clientRegistry)) {
    const full = mergeConfig(partial);
    if (!full.companyId || !full.stageGrantsByRole) continue;
    const roleMap: Record<string, RoleStageGrantMap> = {};
    for (const [role, grants] of Object.entries(full.stageGrantsByRole)) {
      const mapped = toRoleMap(grants);
      if (mapped) roleMap[role] = mapped;
    }
    out[full.companyId] = roleMap;
  }
  return out;
}

/** company_id → uses floor portals */
function buildFloorPortalMap(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const partial of Object.values(clientRegistry)) {
    const full = mergeConfig(partial);
    if (!full.companyId) continue;
    out[full.companyId] = full.usesFloorPortals === true;
  }
  return out;
}

const TENANT_ROLE_STAGE_GRANTS = buildTenantRoleGrants();
const TENANT_USES_FLOOR_PORTALS = buildFloorPortalMap();

export function tenantUsesFloorPortals(actor: StageActor): boolean {
  if (!actor.company_id) return false;
  return TENANT_USES_FLOOR_PORTALS[actor.company_id] === true;
}

const ALL_STAGES: OrderStage[] = [
  "enquiry",
  "site_visit",
  "quotation",
  "invoice",
  "design",
  "production",
  "installation",
  "service_tickets",
];

function adminGrantMap(): RoleStageGrantMap {
  const map: RoleStageGrantMap = {};
  for (const s of ALL_STAGES) map[s] = { canView: true, canEdit: true };
  return map;
}

/** Resolve the full grant map for an actor (admin → all view+edit; staff → tenant/default lookup). */
export function resolveRoleGrantMap(actor: StageActor): RoleStageGrantMap {
  if (actor.role === "admin") return adminGrantMap();
  if (actor.role !== "staff") return {};
  const staffRole = actor.staff_role ?? "";
  const tenantGrants = actor.company_id
    ? TENANT_ROLE_STAGE_GRANTS[actor.company_id]
    : undefined;
  return tenantGrants?.[staffRole] ?? DEFAULT_STAGE_GRANTS_BY_ROLE[staffRole] ?? {};
}

/** Resolve the grant for a single stage (defaults to no access when omitted). */
export function resolveStageGrant(
  actor: StageActor,
  stage: OrderStage
): StagePermission {
  const map = resolveRoleGrantMap(actor);
  return map[stage] ?? { canView: false, canEdit: false };
}

/** Stages where the actor can edit (drives sidebar queue tabs). */
export function getEditableStages(actor: StageActor): OrderStage[] {
  const map = resolveRoleGrantMap(actor);
  return ALL_STAGES.filter((s) => map[s]?.canEdit === true);
}

/** Stages where the actor can view (drives timeline navigation when reached). */
export function getViewableStages(actor: StageActor): OrderStage[] {
  const map = resolveRoleGrantMap(actor);
  return ALL_STAGES.filter((s) => map[s]?.canView === true);
}

/** Available staff_role labels for a tenant — used by EmployeeModal dropdown. */
export function getStaffRolesForTenant(companyId?: string | null): string[] {
  if (companyId) {
    const tenantMap = TENANT_ROLE_STAGE_GRANTS[companyId];
    if (tenantMap && Object.keys(tenantMap).length > 0) {
      return Object.keys(tenantMap);
    }
  }
  // Fall back to deploy client's roles, then defaults
  try {
    const deploy = loadClientConfig();
    if (deploy.stageGrantsByRole && Object.keys(deploy.stageGrantsByRole).length > 0) {
      return Object.keys(deploy.stageGrantsByRole);
    }
  } catch {
    /* ignore */
  }
  return Object.keys(DEFAULT_STAGE_GRANTS_BY_ROLE);
}

/**
 * Floor/kiosk production portal — not the default staff entry path.
 * Requires tenant opt-in; stage grants alone are not enough.
 */
export function canAccessProductionPortal(actor: StageActor): boolean {
  if (actor.role === "admin") return true;
  if (!tenantUsesFloorPortals(actor)) return false;
  return getEditableStages(actor).includes("production");
}

/**
 * Floor/kiosk installation portal — not the default staff entry path.
 * Requires tenant opt-in; stage grants alone are not enough.
 */
export function canAccessInstallationPortal(actor: StageActor): boolean {
  if (actor.role === "admin") return true;
  if (!tenantUsesFloorPortals(actor)) return false;
  const stages = getEditableStages(actor);
  if (stages.includes("installation")) return true;
  if (
    stages.includes("site_visit") &&
    !stages.some((s) => s === "quotation" || s === "design" || s === "production")
  ) {
    return true;
  }
  return false;
}

/** Pipeline stages collapsed into a single My Orders nav item. */
export const MY_ORDERS_NAV: StaffNavItem = {
  href: "/staff/my-orders",
  label: "My Orders",
  icon: "orders",
};

/** Editable pipeline stages for My Orders tabs (subset of grants). */
export function getMyOrdersStages(actor: StageActor): OrderStage[] {
  return getEditableStages(actor).filter(isPipelineNavStage);
}

/** Post-login redirect for staff — first grant-based queue tab. */
export function getStaffHomePath(actor: StageActor): string {
  if (actor.role === "admin") return "/admin/dashboard";
  const items = getNavItemsForActor(actor);
  const myOrders = items.find((item) => item.href === MY_ORDERS_NAV.href);
  if (myOrders) return myOrders.href;
  const firstQueue = items.find(
    (item) =>
      item.href !== "/staff/settings" &&
      item.href !== "/staff/tasks" &&
      item.href !== "/staff/calendar"
  );
  return firstQueue?.href ?? "/staff/my-orders";
}

export type StaffNavIcon =
  | "orders"
  | "invoice"
  | "enquiry"
  | "site_visit"
  | "design"
  | "production"
  | "installation"
  | "support"
  | "tasks"
  | "calendar"
  | "settings";

export interface StaffNavItem {
  href: string;
  label: string;
  icon: StaffNavIcon;
  /** When on /staff/orders/[id], highlight this tab if entryStage query matches. */
  orderDetailEntryStage?: OrderStage;
}

const STAGE_NAV: Record<OrderStage, StaffNavItem> = {
  enquiry: {
    href: "/staff/enquiries",
    label: "Enquiries",
    icon: "enquiry",
  },
  site_visit: {
    href: "/staff/site-visit",
    label: "Site Visit",
    icon: "site_visit",
    orderDetailEntryStage: "site_visit",
  },
  quotation: {
    href: "/staff/orders",
    label: "Quotations",
    icon: "orders",
    orderDetailEntryStage: "quotation",
  },
  invoice: {
    href: "/staff/invoices",
    label: "Invoices",
    icon: "invoice",
  },
  design: {
    href: "/staff/design",
    label: "Design",
    icon: "design",
    orderDetailEntryStage: "design",
  },
  production: {
    href: "/staff/production",
    label: "Production",
    icon: "production",
    orderDetailEntryStage: "production",
  },
  installation: {
    href: "/staff/installation",
    label: "Installation",
    icon: "installation",
    orderDetailEntryStage: "installation",
  },
  service_tickets: {
    href: "/staff/service-tickets",
    label: "Service Tickets",
    icon: "support",
    orderDetailEntryStage: "service_tickets",
  },
};

const NAV_STAGE_ORDER: OrderStage[] = [
  "enquiry",
  "site_visit",
  "quotation",
  "invoice",
  "design",
  "production",
  "installation",
  "service_tickets",
];

/** Sidebar tabs derived from tenant stage grants (canEdit stages only; enquiry also shows for canView). */
export function getNavItemsForActor(actor: StageActor): StaffNavItem[] {
  const editable = getEditableStages(actor);
  const viewable = getViewableStages(actor);
  const items: StaffNavItem[] = [];
  const hasMyOrders = editable.some(isPipelineNavStage);
  let myOrdersInserted = false;

  for (const stage of NAV_STAGE_ORDER) {
    if (isPipelineNavStage(stage)) {
      if (hasMyOrders && !myOrdersInserted) {
        items.push({ ...MY_ORDERS_NAV });
        myOrdersInserted = true;
      }
      continue;
    }

    const show =
      stage === "enquiry"
        ? viewable.includes(stage) || editable.includes(stage)
        : editable.includes(stage);
    if (show) {
      items.push({ ...STAGE_NAV[stage] });
    }
  }

  if (items.length === 0) {
    items.push({ ...MY_ORDERS_NAV });
  }

  items.push({ href: "/staff/tasks", label: "My Tasks", icon: "tasks" });
  items.push({ href: "/staff/calendar", label: "Calendar", icon: "calendar" });
  items.push({ href: "/staff/settings", label: "Settings", icon: "settings" });
  return items;
}

const BACK_HREF_BY_STAGE: Record<OrderStage, string> = {
  enquiry: "/staff/enquiries",
  site_visit: "/staff/my-orders?stage=site_visit",
  quotation: "/staff/my-orders?stage=quotation",
  invoice: "/staff/invoices",
  design: "/staff/my-orders?stage=design",
  production: "/staff/my-orders?stage=production",
  installation: "/staff/my-orders?stage=installation",
  service_tickets: "/staff/service-tickets",
};

export function getStaffOrderBackHref(entryStage?: OrderStage | null): string {
  if (entryStage && BACK_HREF_BY_STAGE[entryStage]) {
    return BACK_HREF_BY_STAGE[entryStage];
  }
  return "/staff/my-orders";
}

/** Map legacy queue URL slug → My Orders stage query. */
export const QUEUE_SLUG_TO_STAGE: Record<string, OrderStage> = {
  orders: "quotation",
  "site-visit": "site_visit",
  design: "design",
  production: "production",
  installation: "installation",
};

export function parseOrderStage(value?: string | null): OrderStage | undefined {
  if (!value) return undefined;
  return ALL_STAGES.includes(value as OrderStage)
    ? (value as OrderStage)
    : undefined;
}
