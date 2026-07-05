import type { OrderStage, StageActor } from "./types";

export const PRINTOMS_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
export const BOARD_COMPANY_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Tenants that use dedicated /production and /installation floor/kiosk portals.
 * All other staff (including production/installation grant holders) use /staff/login.
 */
export const TENANT_USES_FLOOR_PORTALS: Record<string, boolean> = {
  [PRINTOMS_COMPANY_ID]: true,
};

/**
 * Default stage grants by staff_role. Used when no tenant-specific override
 * exists in TENANT_STAGE_GRANTS for the actor's company_id.
 */
export const STAGE_GRANTS_BY_STAFF_ROLE: Record<string, OrderStage[]> = {
  Production: ["production"],
  Installation: ["site_visit", "installation"],
  Designer: ["site_visit", "design"],
  Marketer: ["site_visit", "quotation"],
};

/**
 * Per-tenant stage grant overrides, keyed by company_id.
 */
export const TENANT_STAGE_GRANTS: Record<string, Record<string, OrderStage[]>> = {
  [PRINTOMS_COMPANY_ID]: {
    Installation: ["installation"],
  },
  [BOARD_COMPANY_ID]: {
    Designer: ["design"],
    "Production & Service": ["production"],
    "Recce & Installation": ["site_visit", "installation"],
  },
};

export function tenantUsesFloorPortals(actor: StageActor): boolean {
  if (!actor.company_id) return false;
  return TENANT_USES_FLOOR_PORTALS[actor.company_id] === true;
}

export function getEditableStages(actor: StageActor): OrderStage[] {
  if (actor.role === "admin") {
    return ["site_visit", "quotation", "design", "production", "installation"];
  }
  if (actor.role !== "staff") {
    return [];
  }
  const staffRole = actor.staff_role ?? "";
  const tenantGrants = actor.company_id ? TENANT_STAGE_GRANTS[actor.company_id] : undefined;
  return tenantGrants?.[staffRole] ?? STAGE_GRANTS_BY_STAFF_ROLE[staffRole] ?? [];
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
    label: "Orders",
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
};

const NAV_STAGE_ORDER: OrderStage[] = [
  "site_visit",
  "quotation",
  "design",
  "production",
  "installation",
];

/** Sidebar tabs derived from tenant stage grants. */
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

  items.push({ href: "/staff/settings", label: "Settings", icon: "settings" });
  return items;
}

const BACK_HREF_BY_STAGE: Record<OrderStage, string> = {
  site_visit: "/staff/site-visit",
  quotation: "/staff/orders",
  design: "/staff/design",
  production: "/staff/production",
  installation: "/staff/installation",
};

export function getStaffOrderBackHref(entryStage?: OrderStage | null): string {
  if (entryStage && BACK_HREF_BY_STAGE[entryStage]) {
    return BACK_HREF_BY_STAGE[entryStage];
  }
  return "/staff/orders";
}

const VALID_ORDER_STAGES: OrderStage[] = [
  "site_visit",
  "quotation",
  "design",
  "production",
  "installation",
];

export function parseOrderStage(value?: string | null): OrderStage | undefined {
  if (!value) return undefined;
  return VALID_ORDER_STAGES.includes(value as OrderStage)
    ? (value as OrderStage)
    : undefined;
}
