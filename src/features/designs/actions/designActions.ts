"use server";

import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DesignRecord } from "@/types";
import { mapDesignFromDb } from "./designMapper";
import { mergePortalDesignItemsPreservingStaffDrafts } from "@/features/designs/utils/customerVisibleDesign";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  assertAdminOnly,
  assertStageEditPermission,
} from "@/features/orders/workspace/shared/serverPermissions";
import { getDesignItemsWithVersions } from "@/features/designs/utils/designApproval";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import {
  revalidateOrderDetailPaths,
} from "@/features/orders/actions/revalidateOrderPaths";
import { insertOrderActivity } from "@/features/orders/activity/logOrderActivity";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; safe to ignore.
          }
        },
      },
    }
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Server configuration error");
  return admin;
}

function isDesignStageLocked(stage: string, stageStatus: string | null): boolean {
  if (!stageStatus || stageStatus === "Normal") return false;
  return stage === "Design In Progress" || stage === "Design Approved";
}

async function resolveOrderUuid(supabase: SupabaseClient, idOrOrderId: string): Promise<string> {
  if (uuidPattern.test(idOrOrderId)) return idOrOrderId;
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", idOrOrderId)
    .maybeSingle();
  if (error || !data) throw new Error(`Could not resolve order ID: ${idOrOrderId}`);
  return data.id;
}

async function assertPortalDesignAccess(
  orderUuid: string,
  portalToken?: string
): Promise<void> {
  const { assertPortalTenantAccess } = await import(
    "@/utils/portal/portalTenantAuth"
  );
  await assertPortalTenantAccess({
    orderId: orderUuid,
    portalToken,
    requiredScope: "approve_design",
  });
}

async function assertDesignStageUnlockedForOrder(
  supabase: SupabaseClient,
  orderUuid: string
): Promise<void> {
  const profile = await getCurrentUser();
  if (profile?.role?.toLowerCase() === "admin") return;

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

async function getDesignMutationContext(
  orderId: string,
  portalToken?: string
): Promise<{ supabase: SupabaseClient; orderUuid: string; fromPortal: boolean }> {
  const profile = await getCurrentUser();
  if (profile) {
    const actor = {
      role: profile.role,
      staff_role: profile.staff_role ?? null,
      company_id: profile.company_id ?? null,
    };
    const { canEdit } = resolveStagePermission("design", actor);
    if (canEdit) {
      const supabase = await getSupabase();
      const orderUuid = await resolveOrderUuid(supabase, orderId);
      await assertDesignStageUnlockedForOrder(supabase, orderUuid);
      return { supabase, orderUuid, fromPortal: false };
    }
  }

  const admin = requireAdminClient();
  const orderUuid = await resolveOrderUuid(admin, orderId);
  await assertPortalDesignAccess(orderUuid, portalToken);
  await assertDesignStageUnlockedForOrder(admin, orderUuid);
  return { supabase: admin, orderUuid, fromPortal: true };
}

async function revalidateDesignPaths(orderId: string, fromPortal = false) {
  revalidateOrderDetailPaths(orderId);
  if (fromPortal) {
    revalidatePath("/printoms/portal");
  }
}

async function updateOrderStage(supabase: SupabaseClient, orderUuid: string, stage: string) {
  const { data: o, error } = await supabase
    .from("orders")
    .select("stage, health, order_id, company_id")
    .eq("id", orderUuid)
    .single();
  if (error) throw new Error(error.message);

  const isChanged = stage !== o.stage;
  if (isChanged) {
    const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
    const { error: updateError } = await supabase
      .from("orders")
      .update({ stage, ...stageProgressPatch(o.health) })
      .eq("id", orderUuid);
    if (updateError) throw new Error(updateError.message);

    await insertOrderActivity(supabase, {
      order_id: o.order_id || orderUuid,
      company_id: o.company_id,
      actor_name: "System",
      actor_role: "System",
      content: `Order stage changed from "${o.stage}" to "${stage}".`,
      metadata: { action: "stage_changed", old: o.stage, new: stage }
    });
  }
}

export async function getDesignByOrderId(orderId: string): Promise<DesignRecord | null> {
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data, error } = await supabase
    .from("designs")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDesignFromDb(data);
}

export async function updateDesignDetailsAction(
  orderId: string,
  details: Partial<DesignRecord>,
  expectedUpdatedAt?: string,
  portalToken?: string
): Promise<DesignRecord> {
  const { supabase, orderUuid, fromPortal } = await getDesignMutationContext(orderId, portalToken);

  const { data: current, error: fetchError } = await supabase
    .from("designs")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const payload: Record<string, unknown> = {
    order_id: orderUuid,
    resources: current?.resources || [],
    items: current?.items || [],
    ...details,
  };
  payload.order_id = orderUuid;

  // Portal clients only see customer-visible items (staff drafts + production files
  // stripped). Re-attach staff-only data from the DB so customer feedback/approval
  // never wipes a designer's in-progress work.
  if (fromPortal && Array.isArray(details.items)) {
    payload.items = mergePortalDesignItemsPreservingStaffDrafts(
      (current?.items as any[]) || [],
      details.items
    );
  }

  let data: Record<string, unknown> | null = null;
  let error: Error | null = null;

  if (!current) {
    const { data: inserted, error: insertError } = await supabase
      .from("designs")
      .upsert(payload, { onConflict: "order_id" })
      .select()
      .single();
    data = inserted;
    error = insertError;
  } else {
    let query = supabase
      .from("designs")
      .update(payload)
      .eq("order_id", orderUuid);
    if (expectedUpdatedAt) {
      query = query.eq("updated_at", expectedUpdatedAt);
    }
    const { data: updated, error: updateError } = await query
      .select()
      .maybeSingle();
    data = updated;
    error = updateError;
    if (!updateError && expectedUpdatedAt && !updated) {
      throw new Error("Design was updated by another user. Please refresh and try again.");
    }
  }

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Failed to update design.");

  await revalidateDesignPaths(orderId, fromPortal);
  return mapDesignFromDb(data);
}

export async function sendDesignToCustomerAction(orderId: string): Promise<DesignRecord> {
  await assertStageEditPermission("design");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  await assertDesignStageUnlockedForOrder(supabase, orderUuid);
  const design = await getDesignByOrderId(orderId);
  if (!design) throw new Error("Design not found");

  const hadChangesRequested = design.items.some((item) =>
    item.versions.some((v) => v.status === "Changes Requested")
  );

  const items = design.items.map((item) => ({
    ...item,
    versions: item.versions.map((v) =>
      v.status === "Draft" || v.status === "Changes Requested"
        ? { ...v, status: "Sent to Customer" as const }
        : v
    )
  }));

  const result = await updateDesignDetailsAction(orderId, { items }, design.updated_at);

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: hadChangesRequested
      ? "design_revision_uploaded"
      : "design_ready_for_review",
    orderUuid,
    idempotencyKey: `${hadChangesRequested ? "design_revision" : "design_ready"}:${orderUuid}:${Date.now()}`,
    baseUrl,
  });

  return result;
}

export async function transitionDesignOrderStageAction(
  orderId: string,
  stage: string,
  portalToken?: string
): Promise<void> {
  const { supabase, orderUuid, fromPortal } = await getDesignMutationContext(orderId, portalToken);
  await updateOrderStage(supabase, orderUuid, stage);
  await revalidateDesignPaths(orderId, fromPortal);
}

/**
 * Admin-only: mark every design item's latest version Approved and move the order
 * to Design Approved (mirrors adminMarkQuotationApprovedAction). Does not require
 * portal customer approval or production files.
 */
export async function adminMarkDesignApprovedAction(orderId: string): Promise<DesignRecord> {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("order_id, company_id, stage, health")
    .eq("id", orderUuid)
    .single();
  if (orderError) throw new Error(orderError.message);
  if (!order.company_id) throw new Error("company_id is required to log design activity");
  if (order.stage !== "Design In Progress" && order.stage !== "Design Approved") {
    throw new Error("Design can only be force-approved while the order is in a Design stage.");
  }

  const { data: designRow, error: designFetchError } = await supabase
    .from("designs")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (designFetchError) throw new Error(designFetchError.message);
  if (!designRow) throw new Error("Design not found");

  const design = mapDesignFromDb(designRow);
  if (getDesignItemsWithVersions(design.items).length === 0) {
    throw new Error("Upload at least one design proof before approving without customer.");
  }

  const items = design.items.map((item) => {
    if (!Array.isArray(item.versions) || item.versions.length === 0) return item;
    const versions = item.versions.map((v, idx) =>
      idx === item.versions.length - 1 ? { ...v, status: "Approved" as const } : v
    );
    return { ...item, versions };
  });

  const { data: updated, error: designUpdateError } = await supabase
    .from("designs")
    .update({ items })
    .eq("order_id", orderUuid)
    .select()
    .single();
  if (designUpdateError) throw new Error(designUpdateError.message);
  if (!updated) throw new Error("Failed to update design.");

  if (order.stage === "Design In Progress") {
    const { stageProgressPatch } = await import("@/features/orders/lib/orderHealth");
    const { error: stageError } = await supabase
      .from("orders")
      .update({
        stage: "Design Approved",
        stage_status: "Normal",
        ...stageProgressPatch(order.health),
      })
      .eq("id", orderUuid);
    if (stageError) throw new Error(stageError.message);
  }

  await insertOrderActivity(supabase, {
    order_id: order.order_id || orderUuid,
    company_id: order.company_id,
    actor_name: "System",
    actor_role: "System",
    content: "Admin marked the design as approved without customer portal approval.",
    metadata: { action: "design_approved_by_admin" },
  });

  await revalidateDesignPaths(orderId);
  return mapDesignFromDb(updated);
}
