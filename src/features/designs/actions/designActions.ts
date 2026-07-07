"use server";

import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DesignRecord } from "@/types";
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

export async function updateDesignDetailsAction(
  orderId: string,
  details: Partial<DesignRecord>,
  expectedUpdatedAt?: string
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

  const payload: Record<string, unknown> = {
    order_id: orderUuid,
    resources: current?.resources || [],
    items: current?.items || [],
    ...details
  };
  payload.order_id = orderUuid;

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

  await revalidateDesignPaths(orderId);
  return mapDesignFromDb(data);
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

  const result = await updateDesignDetailsAction(orderId, { items }, design.updated_at);

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

export async function transitionDesignOrderStageAction(
  orderId: string,
  stage: string
): Promise<void> {
  await assertStageEditOrPortalOrder("design", orderId);
  const supabase = await getSupabase();
  const orderUuid = await resolveOrderUuid(supabase, orderId);
  await updateOrderStage(supabase, orderUuid, stage);
  await revalidateDesignPaths(orderId);
}
