import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/features/auth/actions/authActions";

type OrderActivityInsert = {
  order_id: string;
  company_id: string;
  activity_type?: "timeline" | "internal" | "customer";
  actor_name: string;
  actor_role: string;
  actor_id?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};

export type ActivityActor = {
  actor_name: string;
  actor_role: string;
  actor_id: string | null;
};

const SYSTEM_ACTOR: ActivityActor = {
  actor_name: "System",
  actor_role: "System",
  actor_id: null,
};

/** Resolve the signed-in user for timeline attribution (falls back to System). */
export async function resolveActivityActor(
  fallback: ActivityActor = SYSTEM_ACTOR
): Promise<ActivityActor> {
  const profile = await getCurrentUser();
  if (!profile) return fallback;

  const roleRaw = String(profile.role || "").toLowerCase();
  const actor_role =
    roleRaw === "admin"
      ? "Admin"
      : (profile.staff_role && String(profile.staff_role).trim()) ||
        (roleRaw === "staff" ? "Staff" : fallback.actor_role);

  return {
    actor_name:
      (profile.name && String(profile.name).trim()) ||
      (profile.email && String(profile.email).trim()) ||
      fallback.actor_name,
    actor_role,
    actor_id: profile.id ?? null,
  };
}

/** Insert timeline/activity rows with required tenant scope (friendly order_id is not globally unique). */
export async function insertOrderActivity(
  supabase: SupabaseClient,
  row: OrderActivityInsert | OrderActivityInsert[]
) {
  const inputRows = Array.isArray(row) ? row : [row];
  for (const r of inputRows) {
    if (!r.company_id) {
      throw new Error("insertOrderActivity requires company_id");
    }
  }

  // Replace hardcoded "System" with the signed-in user when a session exists.
  const resolved = await resolveActivityActor();
  const rows = inputRows.map((r) => {
    const useResolved =
      resolved.actor_name !== "System" &&
      (!r.actor_name || r.actor_name === "System");

    return {
      activity_type: "timeline" as const,
      ...r,
      ...(useResolved
        ? {
            actor_name: resolved.actor_name,
            actor_role: resolved.actor_role,
            actor_id: resolved.actor_id,
          }
        : {}),
    };
  });

  return supabase.from("order_activity").insert(rows);
}
