import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "./permissions";
import type { OrderStage } from "./types";

/**
 * Server-side authority check (Layer 2 of RBAC — see plan).
 * Mirrors the UI's resolveStagePermission so both layers stay in sync.
 *
 * Only call this from mutation actions that are exclusively staff/admin-authored.
 * Do NOT call from actions also invoked by the customer portal (e.g. scheduleSiteVisitAction,
 * updateDesignDetailsAction) — those need a customer-aware check, which is out of scope here.
 */
export async function assertStageEditPermission(stage: OrderStage): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }

  const actor = {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  };
  const { canEdit } = resolveStagePermission(stage, actor);

  if (!canEdit) {
    throw new Error(`Forbidden: you do not have permission to edit the ${stage} stage`);
  }
}

/**
 * Server-side admin-only check (Phase 6) for actions outside the stage RBAC
 * model, e.g. Payments — admin-only regardless of staff_role stage grants.
 */
export async function assertAdminOnly(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (profile.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
}
