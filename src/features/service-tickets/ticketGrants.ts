import type { StageActor } from "@/features/orders/workspace/shared/types";
import {
  BOARD_COMPANY_ID,
} from "@/features/orders/workspace/shared/stageGrants";

export interface TicketPermission {
  canView: boolean;
  canManage: boolean;
}

const FULL_ACCESS: TicketPermission = { canView: true, canManage: true };
const NO_ACCESS: TicketPermission = { canView: false, canManage: false };

/**
 * Default staff-role ticket grants.
 * Kept empty so support ticket access is admin-only unless tenant-configured.
 */
export const DEFAULT_TICKET_GRANTS_BY_ROLE: Record<string, TicketPermission> = {};

/**
 * Per-tenant support ticket handling role map.
 * Extend per company as needed.
 */
export const TENANT_TICKET_GRANTS: Record<string, Record<string, TicketPermission>> = {
  [BOARD_COMPANY_ID]: {
    "Production & Service": FULL_ACCESS,
  },
};

export function resolveTicketPermission(actor: StageActor): TicketPermission {
  if (actor.role === "admin") return FULL_ACCESS;
  if (actor.role !== "staff") return NO_ACCESS;
  const role = actor.staff_role ?? "";
  const tenantMap = actor.company_id ? TENANT_TICKET_GRANTS[actor.company_id] : undefined;
  return tenantMap?.[role] ?? DEFAULT_TICKET_GRANTS_BY_ROLE[role] ?? NO_ACCESS;
}

