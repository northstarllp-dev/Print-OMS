import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "./permissions";
import type { OrderStage } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOrderUuidForLock(
  supabase: SupabaseClient,
  orderId: string
): Promise<string> {
  if (uuidPattern.test(orderId)) return orderId;
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !data) throw new Error(`Could not resolve order ID: ${orderId}`);
  return data.id;
}

function isDesignStageLocked(stage: string, stageStatus: string | null): boolean {
  if (!stageStatus || stageStatus === "Normal") return false;
  return stage === "Design In Progress" || stage === "Design Approved";
}

/**
 * Blocks design mutations when the order is pending admin approval on a design stage.
 * Admins bypass this check.
 */
export async function assertDesignStageUnlocked(orderId: string): Promise<void> {
  const profile = await getCurrentUser();
  if (profile?.role?.toLowerCase() === "admin") return;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const orderUuid = await resolveOrderUuidForLock(supabase, orderId);
  const { data: order, error } = await supabase
    .from("orders")
    .select("stage, stage_status")
    .eq("id", orderUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Order not found");

  if (isDesignStageLocked(order.stage, order.stage_status)) {
    throw new Error(
      "Design is locked pending admin approval. Please wait for admin review or requested changes."
    );
  }
}

/**
 * Server-side authority check (Layer 2 of RBAC — see plan).
 * Mirrors the UI's resolveStagePermission so both layers stay in sync.
 *
 * Only call this from mutation actions that are exclusively staff/admin-authored.
 * For actions also invoked by the customer portal, use assertStageEditOrPortalOrder.
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

/** Valid customer portal session for the given order (uuid or friendly order_id). */
export async function assertValidPortalSessionForOrder(
  orderId: string,
  requiredScope?: string
): Promise<void> {
  const { assertPortalTenantAccess } = await import(
    "@/utils/portal/portalTenantAuth"
  );
  await assertPortalTenantAccess({
    orderId,
    requiredScope,
  });
}

/**
 * Staff/admin with stage grant, or a valid customer portal session for the order.
 * Use for mutations shared with the customer portal (e.g. design approve/revise).
 */
export async function assertStageEditOrPortalOrder(
  stage: OrderStage,
  orderId: string,
  requiredPortalScope?: string
): Promise<void> {
  const profile = await getCurrentUser();
  if (profile) {
    const actor = {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    };
    const { canEdit } = resolveStagePermission(stage, actor);
    if (!canEdit) {
      throw new Error(`Forbidden: you do not have permission to edit the ${stage} stage`);
    }
    return;
  }

  const stageScope: Partial<Record<OrderStage, string>> = {
    site_visit: "schedule_visit",
    quotation: "approve_quote",
    design: "approve_design",
  };
  await assertValidPortalSessionForOrder(
    orderId,
    requiredPortalScope ?? stageScope[stage]
  );
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

/** Authenticated admin or staff (blocks portal / anon callers). */
export async function assertStaffOrAdmin(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (profile.role !== "admin" && profile.role !== "staff") {
    throw new Error("Forbidden: staff or admin access required");
  }
}

/**
 * Team assignment: admins always; staff only with enquiry edit
 * (post-convert AssignTeamModal).
 */
export async function assertCanAssignOrderTeam(): Promise<void> {
  const profile = await getCurrentUser();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  if (profile.role === "admin") return;

  if (profile.role === "staff") {
    const { canEdit } = resolveStagePermission("enquiry", {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    });
    if (canEdit) return;
  }

  throw new Error("Forbidden: you do not have permission to assign employees to orders");
}

/**
 * Generic order patch gate. Status-only patches (stage advancement requests)
 * require staff/admin; any other column requires admin.
 */
export async function assertOrderUpdateAccess(
  updates: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(updates);
  const statusOnly =
    keys.length > 0 &&
    keys.every((k) => k === "stage_status" || k === "stage_admin_notes");
  if (statusOnly) {
    await assertStaffOrAdmin();
    return;
  }
  await assertAdminOnly();
}
