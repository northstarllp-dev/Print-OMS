"use server";

import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DesignRecord, DesignComment, DesignVersion } from "@/types";
import { mapDesignFromDb } from "./designMapper";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import {
  assertStageEditOrPortalOrder,
  assertStageEditPermission,
} from "@/features/orders/workspace/shared/serverPermissions";
import {
  revalidateOrderDetailPaths,
  revalidateStaffQueuePaths,
} from "@/features/orders/actions/orderActions";

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

async function revalidateDesignPaths(orderId: string) {
  await revalidateStaffQueuePaths();
  await revalidateOrderDetailPaths(orderId);
}

async function updateOrderStage(supabase: SupabaseClient, orderUuid: string, stage: string) {
  const { data: o, error } = await supabase
    .from("orders")
    .select("stage, order_id")
    .eq("id", orderUuid)
    .single();
  if (error) throw new Error(error.message);

  const isChanged = stage !== o.stage;
  if (isChanged) {
    const { error: updateError } = await supabase
      .from("orders")
      .update({ stage })
      .eq("id", orderUuid);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("order_activity").insert({
      order_id: o.order_id || orderUuid,
      activity_type: "timeline",
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

export async function createDesignForOrderAction(orderId: string): Promise<DesignRecord> {
  await assertStageEditPermission("design");
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  const { data, error } = await supabase
    .from("designs")
    .upsert({
      order_id: orderUuid,
      resources: [],
      items: [],
    }, { onConflict: "order_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await revalidateDesignPaths(orderId);
  return mapDesignFromDb(data);
}

export async function updateDesignDetailsAction(
  orderId: string,
  details: Partial<DesignRecord>
): Promise<DesignRecord> {
  await assertStageEditOrPortalOrder("design", orderId);
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);

  const { data: current, error: fetchError } = await supabase
    .from("designs")
    .select("*")
    .eq("order_id", orderUuid)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const payload = {
    order_id: orderUuid,
    resources: current?.resources || [],
    items: current?.items || [],
    ...details
  };
  payload.order_id = orderUuid;

  const { data, error } = await supabase
    .from("designs")
    .upsert(payload, { onConflict: "order_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await revalidateDesignPaths(orderId);
  return mapDesignFromDb(data);
}

export async function updateDesignItemStatusAction(
  orderId: string,
  itemId: string,
  versionId: string,
  status: DesignVersion["status"],
  updateStage?: string
): Promise<DesignRecord> {
  await assertStageEditOrPortalOrder("design", orderId);
  const design = await getDesignByOrderId(orderId);
  if (!design) throw new Error("Design not found");

  const items = design.items.map((item) => {
    if (item.id !== itemId) return item;
    const versions = item.versions.map((v) =>
      v.id === versionId ? { ...v, status } : v
    );
    const currentVersion = versions.length > 0 ? versions[versions.length - 1].versionNumber : 0;
    return { ...item, versions, currentVersion };
  });

  const result = await updateDesignDetailsAction(orderId, { items });

  if (updateStage) {
    const supabase = await getSupabase();
    const orderUuid = await resolveOrderUuid(supabase, orderId);
    await updateOrderStage(supabase, orderUuid, updateStage);
    await revalidateDesignPaths(orderId);
  }

  return result;
}

export async function addDesignCommentAction(
  orderId: string,
  itemId: string,
  versionId: string,
  comment: DesignComment,
  updateStage?: string
): Promise<DesignRecord> {
  await assertStageEditOrPortalOrder("design", orderId);
  const design = await getDesignByOrderId(orderId);
  if (!design) throw new Error("Design not found");

  const items = design.items.map((item) => {
    if (item.id !== itemId) return item;
    const versions = item.versions.map((v) => {
      if (v.id !== versionId) return v;
      return { ...v, comments: [...(v.comments || []), comment] };
    });
    return { ...item, versions };
  });

  const result = await updateDesignDetailsAction(orderId, { items });

  if (updateStage) {
    const supabase = await getSupabase();
    const orderUuid = await resolveOrderUuid(supabase, orderId);
    await updateOrderStage(supabase, orderUuid, updateStage);
    await revalidateDesignPaths(orderId);
  }

  return result;
}

export async function sendDesignToCustomerAction(orderId: string): Promise<DesignRecord> {
  await assertStageEditPermission("design");
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

  const result = await updateDesignDetailsAction(orderId, { items });

  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
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

export async function approveAllDesignItemsAction(orderId: string): Promise<DesignRecord> {
  await assertStageEditOrPortalOrder("design", orderId);
  const design = await getDesignByOrderId(orderId);
  if (!design) throw new Error("Design not found");

  const items = design.items.map((item) => {
    const versions = item.versions.map((v, idx) =>
      idx === item.versions.length - 1 ? { ...v, status: "Approved" as const } : v
    );
    return { ...item, versions };
  });

  const result = await updateDesignDetailsAction(orderId, { items });

  const allApproved = items.length > 0 && items.every((item) => {
    const latest = item.versions[item.versions.length - 1];
    return latest && latest.status === "Approved";
  });

  if (allApproved) {
    const supabase = await getSupabase();
    const orderUuid = await resolveOrderUuid(supabase, orderId);
    await updateOrderStage(supabase, orderUuid, "Design Approved");
    const baseUrl = await getRequestBaseUrl();
    await dispatchWhatsAppNotification(supabase, {
      templateKey: "design_approved",
      orderUuid,
      idempotencyKey: `design_approved:${orderUuid}`,
      baseUrl,
    });
    await revalidateDesignPaths(orderId);
  }

  return result;
}
