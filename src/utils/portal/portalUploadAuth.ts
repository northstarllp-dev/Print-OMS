import type { SupabaseClient } from "@supabase/supabase-js";
import { assertValidPortalSessionForOrder } from "@/features/orders/workspace/shared/serverPermissions";
import { verifyPortalToken } from "@/utils/portal-tokens";
import { createAdminClient } from "@/utils/supabase/admin";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOrderUuid(
  supabase: SupabaseClient,
  idOrOrderId: string
): Promise<string> {
  if (uuidPattern.test(idOrOrderId)) return idOrOrderId;
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id", idOrOrderId)
    .maybeSingle();
  if (error || !data) throw new Error("Unauthorized");
  return data.id;
}

async function assertPortalTokenAccess(
  orderId: string,
  requiredScope: string,
  portalToken: string
): Promise<string> {
  const payload = verifyPortalToken(portalToken);
  if (!payload) throw new Error("Unauthorized");
  if (!payload.scopes.includes(requiredScope)) throw new Error("Unauthorized");

  const admin = createAdminClient();
  if (!admin) throw new Error("Unauthorized");

  const orderUuid = await resolveOrderUuid(admin, orderId);
  const { data: order } = await admin
    .from("orders")
    .select("id, order_id, customer_id")
    .eq("id", orderUuid)
    .maybeSingle();
  if (!order) throw new Error("Unauthorized");

  if (
    payload.orderId &&
    (payload.orderId === order.id || payload.orderId === order.order_id)
  ) {
    return orderUuid;
  }

  if (payload.customerId) {
    const { data: customer } = await admin
      .from("customers")
      .select("id")
      .eq("customer_id", payload.customerId)
      .maybeSingle();
    if (customer && order.customer_id === customer.id) return orderUuid;
  }

  throw new Error("Unauthorized");
}

/** Validates portal session cookie or token, returns the order UUID. */
export async function assertPortalUploadAccess(
  orderId: string,
  requiredScope: string,
  portalToken?: string
): Promise<string> {
  try {
    await assertValidPortalSessionForOrder(orderId, requiredScope);
    const admin = createAdminClient();
    if (!admin) throw new Error("Unauthorized");
    return resolveOrderUuid(admin, orderId);
  } catch {
    // Fall through to raw token auth when the HttpOnly cookie is not ready yet.
  }

  if (portalToken) {
    return assertPortalTokenAccess(orderId, requiredScope, portalToken);
  }

  throw new Error("Unauthorized");
}
