import type { StageActor } from "@/features/orders/workspace/shared/types";
import { getStagePermissionInContext } from "@/features/orders/workspace/shared/permissions";

export interface TicketPermission {
  canView: boolean;
  canManage: boolean;
}

export function resolveTicketPermission(actor: StageActor): TicketPermission {
  if (actor.role === "admin") return { canView: true, canManage: true };
  if (actor.role !== "staff") return { canView: false, canManage: false };
  
  const perm = getStagePermissionInContext("service_tickets", actor);
  return {
    canView: perm.canView,
    canManage: perm.canEdit,
  };
}
