import { getServiceClient, PRINTOMS_COMPANY_ID } from "./db";

/** Best-effort cleanup of test-created rows by email suffix. */
export async function cleanupByEmail(email: string) {
  const db = getServiceClient();

  const { data: customers } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .eq("company_id", PRINTOMS_COMPANY_ID);

  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length === 0) {
    await db
      .from("enquiries")
      .delete()
      .eq("email", email)
      .eq("company_id", PRINTOMS_COMPANY_ID);
    return;
  }

  const { data: orders } = await db
    .from("orders")
    .select("id, order_id")
    .in("customer_id", customerIds);

  const orderUuids = (orders ?? []).map((o) => o.id);
  const friendlyIds = (orders ?? []).map((o) => o.order_id);

  if (friendlyIds.length) {
    await db.from("order_activity").delete().in("order_id", friendlyIds);
    await db.from("notification_outbox").delete().in("order_id", friendlyIds);
  }

  if (orderUuids.length) {
    await db.from("quotations").delete().in("order_id", orderUuids);
    await db.from("designs").delete().in("order_id", orderUuids);
    await db.from("site_visits").delete().in("order_id", orderUuids);
    await db.from("productions").delete().in("order_id", orderUuids);
    await db.from("installations").delete().in("order_id", orderUuids);
    await db.from("portal_access_tokens").delete().in("order_id", orderUuids);
    await db.from("orders").delete().in("id", orderUuids);
  }

  await db.from("portal_access_tokens").delete().in("customer_id", customerIds);
  await db.from("enquiries").delete().eq("email", email);
  await db.from("customers").delete().in("id", customerIds);
}
