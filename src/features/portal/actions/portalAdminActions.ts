"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";
import { revokePortalToken } from "@/utils/portal-tokens";
import { isClosedOrderStage } from "@/features/customers/customerLogic";

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

async function revokeTokensByJtis(
  supabase: any,
  jtis: string[]
): Promise<number> {
  let revokedCount = 0;
  for (const jti of jtis) {
    try {
      await revokePortalToken(supabase, jti);
      revokedCount++;
    } catch (e: any) {
      console.error(`[revokePortalAccess] Failed to revoke token ${jti}:`, e.message);
    }
  }
  return revokedCount;
}

/**
 * Revoke all active portal access tokens for a given customer or order.
 * This invalidates any magic links the customer has received via WhatsApp/Email.
 */
export async function revokePortalAccessAction(
  customerId?: string,
  orderId?: string
): Promise<{ revoked: number; message: string }> {
  if (!customerId && !orderId) {
    throw new Error("Either customerId or orderId is required");
  }

  const supabase = await getSupabase();

  // Build the query to find active (non-revoked, non-expired) tokens
  let query = supabase
    .from("portal_access_tokens")
    .select("jti")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }
  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  const { data: tokens, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch portal tokens: ${error.message}`);
  }

  if (!tokens || tokens.length === 0) {
    return { revoked: 0, message: "No active portal tokens found." };
  }

  const revokedCount = await revokeTokensByJtis(
    supabase,
    tokens.map((t) => t.jti)
  );

  return {
    revoked: revokedCount,
    message: `Revoked ${revokedCount} active portal token${revokedCount !== 1 ? "s" : ""}. Customer link is now invalid.`,
  };
}

/**
 * Invalidate customer portal magic links when an order is completed/closed.
 * Revokes tokens for this order (UUID + friendly id) and, if the customer has
 * no remaining open orders, all of their active portal tokens.
 */
export async function revokePortalAccessForClosedOrder(input: {
  customerId?: string | null;
  orderUuid: string;
  friendlyOrderId?: string | null;
}): Promise<void> {
  const db = createAdminClient();
  if (!db) return;

  const orderKeys = Array.from(
    new Set(
      [input.orderUuid, input.friendlyOrderId].filter(
        (v): v is string => typeof v === "string" && !!v.trim()
      )
    )
  );
  if (orderKeys.length === 0) return;

  const { data: orderTokens, error: orderTokErr } = await db
    .from("portal_access_tokens")
    .select("jti")
    .is("revoked_at", null)
    .in("order_id", orderKeys);

  if (orderTokErr) {
    console.error(
      "[revokePortalAccessForClosedOrder] order token lookup failed:",
      orderTokErr.message
    );
  } else if (orderTokens?.length) {
    await revokeTokensByJtis(
      db,
      orderTokens.map((t) => t.jti)
    );
  }

  if (!input.customerId) return;

  const { data: openOrders, error: openErr } = await db
    .from("orders")
    .select("id, stage")
    .eq("customer_id", input.customerId);

  if (openErr) {
    console.error(
      "[revokePortalAccessForClosedOrder] open orders lookup failed:",
      openErr.message
    );
    return;
  }

  const hasOpenOrder = (openOrders || []).some(
    (o) => !isClosedOrderStage(o.stage)
  );
  if (hasOpenOrder) return;

  const { data: customerTokens, error: custTokErr } = await db
    .from("portal_access_tokens")
    .select("jti")
    .eq("customer_id", input.customerId)
    .is("revoked_at", null);

  if (custTokErr) {
    console.error(
      "[revokePortalAccessForClosedOrder] customer token lookup failed:",
      custTokErr.message
    );
    return;
  }

  if (customerTokens?.length) {
    await revokeTokensByJtis(
      db,
      customerTokens.map((t) => t.jti)
    );
  }
}
