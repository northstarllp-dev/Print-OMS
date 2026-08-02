"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";
import webpush from "web-push";

// Initialize web-push with VAPID keys
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface NotificationPayload {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
}

/**
 * Low-level function to create a notification for a specific user and dispatch web push.
 */
export async function createNotification(
  userId: string,
  companyId: string | null,
  payload: NotificationPayload
) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("No admin client");

  // 1. Insert into DB (in-app notification)
  const { data: notif, error } = await supabase
    .from("notifications")
    .insert({
      company_id: companyId,
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link,
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting notification:", error);
    return;
  }

  // 2. Fetch push subscriptions for this user
  const { data: subs, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("push_enabled", true);

  if (subError || !subs || subs.length === 0) return;

  // 3. Dispatch web push to all their active endpoints
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.message,
    icon: "/clients/printoms/favicon_io/favicon-32x32.png", // fallback icon
    data: { link: payload.link },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription is expired or invalid, remove it
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("Error sending web push:", err);
      }
    }
  }
}

/**
 * Save a device push subscription
 */
export async function savePushSubscription(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  companyId: string | null
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Upsert on user_id + endpoint (requires unique constraint)
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({
      user_id: user.id,
      company_id: companyId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      push_enabled: true,
    }, {
      onConflict: 'user_id,endpoint'
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Toggle web push for the current user (affects all their devices)
 */
export async function togglePushEnabled(enabled: boolean) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ push_enabled: enabled })
    .eq("user_id", user.id);

  if (error) throw error;
  return { success: true };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsRead() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Use admin client to bypass RLS UPDATE restrictions
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { error } = await admin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (error) throw error;
  return { success: true };
}

/**
 * Clear (delete) all notifications for current user
 */
export async function clearAllNotifications() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Use admin client to bypass RLS — DELETE policy is not granted to authenticated users
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
  return { success: true };
}
