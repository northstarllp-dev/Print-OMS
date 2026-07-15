"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dispatchWhatsAppNotification } from "@/features/notifications/actions/dispatchNotification";
import { getRequestBaseUrl } from "@/features/notifications/whatsapp/requestBaseUrl";
import { assertStageEditPermission } from "@/features/orders/workspace/shared/serverPermissions";
import { revalidateStaffQueuePaths } from "@/features/orders/actions/orderActions";

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
          } catch {}
        },
      },
    }
  );
}

export async function getInstallationByOrderId(orderId: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("installations")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Row not found, create one
      const { data: newRow, error: insertError } = await supabase
        .from("installations")
        .insert({ order_id: orderId })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newRow;
    }
    throw error;
  }
  return data;
}

export async function updateInstallationDetails(orderId: string, details: any) {
  await assertStageEditPermission("installation");
  const supabase = await getSupabase();
  
  // First ensure record exists
  await getInstallationByOrderId(orderId);

  const { error } = await supabase
    .from("installations")
    .update(details)
    .eq("order_id", orderId);

  if (error) throw error;
  return { success: true };
}

export async function markInstallationCompleted(orderId: string, checklist: any[], photos: any[], notes: string) {
  await assertStageEditPermission("installation");
  const supabase = await getSupabase();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("order_id, stage")
    .eq("id", orderId)
    .single();
  if (fetchError) throw fetchError;

  if (order.stage !== "Installation Scheduled") {
    throw new Error(
      `Installation can only be submitted for admin review when the order is Installation Scheduled (current: "${order.stage}").`
    );
  }

  // Ensure installations row exists before updating
  await getInstallationByOrderId(orderId);

  const { error } = await supabase
    .from("installations")
    .update({
      status: "Completed",
      checklist,
      photos,
      afterPhotos: photos,
      notes,
    })
    .eq("order_id", orderId);

  if (error) throw error;

  const { error: orderError } = await supabase
    .from("orders")
    .update({ stage_status: "Pending Admin Approval: Job Done" })
    .eq("id", orderId);
  if (orderError) throw orderError;

  await supabase.from("order_activity").insert({
    order_id: order.order_id || orderId,
    activity_type: "timeline",
    actor_name: "Installation Team",
    actor_role: "Installation",
    content: `Installation marked complete from "${order.stage}". Pending admin payment review.`,
    metadata: { action: "installation_complete_pending_admin" },
  });

  await revalidateStaffQueuePaths();

  return { success: true };
}

export async function scheduleInstallationAction(orderId: string, payload: { scheduledDate: string, scheduledTime: string }) {
  const supabase = await getSupabase();
  
  // Get current order
  const { data: order, error: fetchError } = await supabase.from("orders").select("stage, order_id").eq("id", orderId).single();
  if (fetchError) throw new Error(fetchError.message);

  // Upsert so it works even if the installations row doesn't exist yet
  const { error: instError } = await supabase.from("installations").upsert({
    order_id: orderId,
    scheduledDate: payload.scheduledDate,
    scheduledTime: payload.scheduledTime
  }, { onConflict: "order_id" });
  if (instError) throw new Error(instError.message);
  
  // Only advance stage if currently "Ready For Installation"
  if (order.stage === "Ready For Installation") {
    const { error } = await supabase.from("orders").update({ stage: "Installation Scheduled" }).eq("id", orderId);
    if (error) throw new Error(error.message);
  }

  // Activity Log
  await supabase.from("order_activity").insert({
    order_id: order.order_id || orderId,
    activity_type: "timeline",
    actor_name: "System",
    actor_role: "System",
    content: `Installation scheduled for ${payload.scheduledDate} at ${payload.scheduledTime}.`,
    metadata: { action: "schedule_installation", ...payload }
  });

  const baseUrl = await getRequestBaseUrl();
  await dispatchWhatsAppNotification(supabase, {
    templateKey: "installation_scheduled",
    orderUuid: orderId,
    date: payload.scheduledDate,
    time: payload.scheduledTime,
    idempotencyKey: `installation_scheduled:${orderId}:${payload.scheduledDate}:${payload.scheduledTime}`,
    baseUrl,
  });

  await revalidateStaffQueuePaths();

  return { success: true };
}
