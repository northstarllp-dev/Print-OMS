import type { OrderStage, StageActor, StagePermission } from "./types";

export const PRINTOMS_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
export const BOARD_COMPANY_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Tenants that use dedicated /production and /installation floor/kiosk portals.
 * All other staff (including production/installation grant holders) use /staff/login.
 */
export const TENANT_USES_FLOOR_PORTALS: Record<string, boolean> = {
  [PRINTOMS_COMPANY_ID]: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Grant matrix — per stage { canView, canEdit }.
// Sidebar queues derive from canEdit; order-timeline navigation uses canView.
// ─────────────────────────────────────────────────────────────────────────────

export type RoleStageGrantMap = Partial<Record<OrderStage, StagePermission>>;

/** Sugar for "edit-only on these stages" (implies canView too). */
function edit(...stages: OrderStage[]): RoleStageGrantMap {
  const map: RoleStageGrantMap = {};
  for (const s of stages) map[s] = { canView: true, canEdit: true };
  return map;
}

/** Sugar for "view-only on these stages". */
function view(...stages: OrderStage[]): RoleStageGrantMap {
  const map: RoleStageGrantMap = {};
  for (const s of stages) map[s] = { canView: true, canEdit: false };
  return map;
}

/** Combine multiple partial maps (later ones override earlier). */
function merge(...maps: RoleStageGrantMap[]): RoleStageGrantMap {
  return Object.assign({}, ...maps);
}

/**
 * Default stage grants by staff_role. Used when no tenant-specific override
 * exists in TENANT_ROLE_STAGE_GRANTS for the actor's company_id.
 */
export const DEFAULT_STAGE_GRANTS_BY_ROLE: Record<string, RoleStageGrantMap> = {
  Production: edit("production", "service_tickets"),
  Installation: edit("site_visit", "installation"),
  Designer: edit("site_visit", "design"),
  Marketer: edit("site_visit", "quotation"),
};

/**
 * Per-tenant stage grant overrides, keyed by company_id → staff_role → matrix.
 */
export const TENANT_ROLE_STAGE_GRANTS: Record<string, Record<string, RoleStageGrantMap>> = {
  [PRINTOMS_COMPANY_ID]: {
    Designer: merge(view("site_visit"), edit("design", "quotation")),
    Production: merge(view("site_visit"), edit("production", "service_tickets")),
    Installation: edit("installation"),
  },
  [BOARD_COMPANY_ID]: {
    Designer: merge(view("site_visit"), edit("design", "quotation")),
    "Production & Service": merge(view("site_visit"), edit("production", "service_tickets")),
    "Recce & Installation": edit("site_visit", "installation"),
  },
};

export function tenantUsesFloorPortals(actor: StageActor): boolean {
  if (!actor.company_id) return false;
  return TENANT_USES_FLOOR_PORTALS[actor.company_id] === true;
}

const ALL_STAGES: OrderStage[] = ["site_visit", "quotation", "design", "production", "installation", "service_tickets"];

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
  const tenantGrants = actor.company_id ? TENANT_ROLE_STAGE_GRANTS[actor.company_id] : undefined;
  return tenantGrants?.[staffRole] ?? DEFAULT_STAGE_GRANTS_BY_ROLE[staffRole] ?? {};
}

/** Resolve the grant for a single stage (defaults to no access when omitted). */
export function resolveStageGrant(actor: StageActor, stage: OrderStage): StagePermission {
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
    if (tenantMap) return Object.keys(tenantMap);
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

/** Post-login redirect for staff — first grant-based queue tab. */
export function getStaffHomePath(actor: StageActor): string {
  if (actor.role === "admin") return "/admin/dashboard";
  const items = getNavItemsForActor(actor);
  const firstQueue = items.find((item) => item.href !== "/staff/settings");
  return firstQueue?.href ?? "/staff/orders";
}

export type StaffNavIcon =
  | "orders"
  | "site_visit"
  | "design"
  | "production"
  | "installation"
  | "support"
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
  "site_visit",
  "quotation",
  "design",
  "production",
  "installation",
  "service_tickets",
];

/** Sidebar tabs derived from tenant stage grants (canEdit stages only). */
export function getNavItemsForActor(actor: StageActor): StaffNavItem[] {
  const stages = getEditableStages(actor);
  const items: StaffNavItem[] = [];

  for (const stage of NAV_STAGE_ORDER) {
    if (stages.includes(stage)) {
      items.push({ ...STAGE_NAV[stage] });
    }
  }

  if (items.length === 0) {
    items.push({ ...STAGE_NAV.quotation });
  }

  items.push({ href: "/staff/calendar", label: "Calendar", icon: "calendar" });
  items.push({ href: "/staff/settings", label: "Settings", icon: "settings" });
  return items;
}

const BACK_HREF_BY_STAGE: Record<OrderStage, string> = {
  site_visit: "/staff/site-visit",
  quotation: "/staff/orders",
  design: "/staff/design",
  production: "/staff/production",
  installation: "/staff/installation",
  service_tickets: "/staff/service-tickets",
};

export function getStaffOrderBackHref(entryStage?: OrderStage | null): string {
  if (entryStage && BACK_HREF_BY_STAGE[entryStage]) {
    return BACK_HREF_BY_STAGE[entryStage];
  }
  return "/staff/orders";
}

export function parseOrderStage(value?: string | null): OrderStage | undefined {
  if (!value) return undefined;
  return ALL_STAGES.includes(value as OrderStage)
    ? (value as OrderStage)
    : undefined;
}
