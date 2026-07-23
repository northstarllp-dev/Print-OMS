import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Insert timeline/activity rows with required tenant scope (friendly order_id is not globally unique). */
export async function insertOrderActivity(
  supabase: SupabaseClient,
  row: OrderActivityInsert | OrderActivityInsert[]
) {
  const rows = (Array.isArray(row) ? row : [row]).map((r) => ({
    activity_type: "timeline" as const,
    ...r,
  }));
  for (const r of rows) {
    if (!r.company_id) {
      throw new Error("insertOrderActivity requires company_id");
    }
  }
  return supabase.from("order_activity").insert(rows);
}
