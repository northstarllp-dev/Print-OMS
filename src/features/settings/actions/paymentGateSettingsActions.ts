"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  PAYMENT_GATE_PHASES,
  getPaymentGatePhaseForStage,
  type PaymentGatePhaseKey,
  type PaymentGateStage,
} from "@/features/settings/paymentGateStages";

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
            // ignore
          }
        },
      },
    }
  );
}

async function requireAdmin() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  // Fallback: some profiles are keyed by email
  const adminProfile =
    profile ||
    (
      await supabase
        .from("users")
        .select("id, role, company_id")
        .eq("email", user.email?.toLowerCase() || "")
        .maybeSingle()
    ).data;

  if (!adminProfile || adminProfile.role !== "admin") {
    throw new Error("Admin access required");
  }
  if (!adminProfile.company_id) {
    throw new Error("Admin profile is missing company_id");
  }
  return { supabase, user, companyId: adminProfile.company_id as string };
}

async function resolveCompanyIdForOrder(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  orderId?: string
): Promise<string | null> {
  if (orderId) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let orderUuid = orderId;
    if (!uuidPattern.test(orderId)) {
      const { data } = await supabase
        .from("orders")
        .select("id, company_id")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data?.company_id) return data.company_id as string;
      if (data?.id) orderUuid = data.id;
    }
    const { data: order } = await supabase
      .from("orders")
      .select("company_id")
      .eq("id", orderUuid)
      .maybeSingle();
    if (order?.company_id) return order.company_id as string;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.company_id) return profile.company_id as string;

  const { data: byEmail } = await supabase
    .from("users")
    .select("company_id")
    .eq("email", user.email?.toLowerCase() || "")
    .maybeSingle();
  return (byEmail?.company_id as string) || null;
}

/**
 * Whether the payment popup should appear when advancing FROM this pipeline stage.
 * Scoped to the order's company (or current user's company).
 * Pass stageStatus so Site Visit completion (pending admin approval) is detected
 * even when orders.stage is still "Site Visit Scheduled".
 */
export async function isPaymentGateEnabledForStage(
  pipelineStage: string,
  orderId?: string,
  stageStatus?: string | null
): Promise<boolean> {
  const phase = getPaymentGatePhaseForStage(pipelineStage, stageStatus);
  if (!phase) return false;

  const supabase = await getSupabase();
  const companyId = await resolveCompanyIdForOrder(supabase, orderId);
  if (!companyId) {
    // No tenant context — fall back to enabled so popup still works
    console.warn("[payment-gate] No company_id; defaulting popup to enabled for", phase.key);
    return true;
  }

  const { data, error } = await supabase
    .from("payment_gate_stages")
    .select("is_enabled")
    .eq("company_id", companyId)
    .eq("stage", phase.key)
    .maybeSingle();

  if (error) {
    console.error("[payment-gate] Failed to read phase setting:", error.message);
    return true;
  }
  // No row for this company → default enabled
  if (!data) return true;
  return Boolean(data.is_enabled);
}

export async function listPaymentGateStages(): Promise<PaymentGateStage[]> {
  const { supabase, companyId } = await requireAdmin();
  const { data, error } = await supabase
    .from("payment_gate_stages")
    .select("*")
    .eq("company_id", companyId)
    .order("stage", { ascending: true });
  if (error) throw new Error(error.message);

  const byKey = new Map((data || []).map((r) => [r.stage as string, r]));

  return PAYMENT_GATE_PHASES.map((phase) => {
    const row = byKey.get(phase.key);
    return {
      id: (row?.id as string) || phase.key,
      stage: phase.key,
      label: phase.label,
      linkedStages: [...phase.linkedStages],
      is_enabled: row ? Boolean(row.is_enabled) : true,
      company_id: companyId,
      created_at: (row?.created_at as string) || "",
      updated_at: (row?.updated_at as string) || "",
    };
  });
}

export async function setPaymentGateStageEnabled(
  phaseKey: PaymentGatePhaseKey | string,
  is_enabled: boolean
): Promise<void> {
  const { supabase, companyId } = await requireAdmin();
  const { error } = await supabase.from("payment_gate_stages").upsert(
    { company_id: companyId, stage: phaseKey, is_enabled },
    { onConflict: "company_id,stage" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings/payments");
  revalidatePath("/admin/settings/notifications");
}
