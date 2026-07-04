import type { OrderStage, StageActor } from "./types";

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
 * Phase 4b MVP: per-tenant stage grant overrides, keyed by company_id.
 * A company with no entry here uses STAGE_GRANTS_BY_STAFF_ROLE (the default).
 * Phase 5 replaces this with DB tables (roles / role_stage_permissions) behind
 * the same getEditableStages() signature.
 *
 * Example:
 * export const TENANT_STAGE_GRANTS: Record<string, Record<string, OrderStage[]>> = {
 *   "11111111-1111-1111-1111-111111111111": {
 *     Installation: ["installation"], // this client's Installation role doesn't cover Site Visit
 *   },
 * };
 */


export const TENANT_STAGE_GRANTS: Record<string, Record<string, OrderStage[]>> = {
  "11111111-1111-1111-1111-111111111111": {
    Installation: ["installation"], // not site_visit
  },    
};

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
