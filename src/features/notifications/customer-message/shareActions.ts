"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import type { CustomerMessageKey } from "./templates";

export type CustomerMessageShareChannel = "copy" | "whatsapp" | "email";

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

function isAdminRole(role: unknown): boolean {
  return String(role ?? "").toLowerCase() === "admin";
}

/** Upsert a share row for this order + template (latest channel/time wins). */
export async function recordCustomerMessageShare(input: {
  orderId: string;
  templateKey: CustomerMessageKey;
  channel: CustomerMessageShareChannel;
}): Promise<{ ok: true } | { error: string }> {
  const orderId = input.orderId?.trim();
  if (!orderId) return { error: "Missing order id" };

  const profile = await getCurrentUser();
  if (!profile) return { error: "Unauthorized" };
  if (!isAdminRole(profile.role)) return { error: "Admin only" };
  const companyId = profile.company_id as string | undefined;
  if (!companyId) return { error: "Company context missing" };

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from("customer_message_shares").upsert(
      {
        company_id: companyId,
        order_id: orderId,
        template_key: input.templateKey,
        channel: input.channel,
        shared_at: new Date().toISOString(),
      },
      { onConflict: "company_id,order_id,template_key" }
    );
    if (error) {
      console.error("[recordCustomerMessageShare]", error.message);
      return { error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record share";
    console.error("[recordCustomerMessageShare]", message);
    return { error: message };
  }
}

/**
 * Template keys already shared for this order.
 * Accepts uuid and/or friendly code so either storage form still matches.
 */
export async function listCustomerMessageShares(
  orderId: string,
  orderCode?: string | null
): Promise<{ keys: CustomerMessageKey[] } | { error: string }> {
  const ids = Array.from(
    new Set(
      [orderId, orderCode].map((v) => v?.trim()).filter(Boolean) as string[]
    )
  );
  if (ids.length === 0) return { keys: [] };

  const profile = await getCurrentUser();
  if (!profile) return { error: "Unauthorized" };
  if (!profile.company_id) return { error: "Company context missing" };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("customer_message_shares")
    .select("template_key")
    .eq("company_id", profile.company_id)
    .in("order_id", ids);

  if (error) {
    console.error("[listCustomerMessageShares]", error.message);
    return { error: error.message };
  }
  return {
    keys: Array.from(
      new Set((data ?? []).map((r) => r.template_key as CustomerMessageKey))
    ),
  };
}
