import { expect } from "@playwright/test";
import { getServiceClient, PRINTOMS_COMPANY_ID } from "./db";

const pollTimeout = 20_000;

export async function expectOrderStage(
  orderUuidOrFriendly: string,
  stage: string
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const byUuid = await db
          .from("orders")
          .select("stage")
          .eq("id", orderUuidOrFriendly)
          .maybeSingle();
        if (byUuid.data?.stage) return byUuid.data.stage;

        const byFriendly = await db
          .from("orders")
          .select("stage")
          .eq("order_id", orderUuidOrFriendly)
          .eq("company_id", PRINTOMS_COMPANY_ID)
          .maybeSingle();
        return byFriendly.data?.stage ?? null;
      },
      { timeout: pollTimeout, message: `order stage → ${stage}` }
    )
    .toBe(stage);
}

export async function expectStageStatus(
  orderUuidOrFriendly: string,
  stageStatus: string
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const byUuid = await db
          .from("orders")
          .select("stage_status")
          .eq("id", orderUuidOrFriendly)
          .maybeSingle();
        if (byUuid.data) return byUuid.data.stage_status;

        const byFriendly = await db
          .from("orders")
          .select("stage_status")
          .eq("order_id", orderUuidOrFriendly)
          .eq("company_id", PRINTOMS_COMPANY_ID)
          .maybeSingle();
        return byFriendly.data?.stage_status ?? null;
      },
      { timeout: pollTimeout, message: `stage_status → ${stageStatus}` }
    )
    .toBe(stageStatus);
}

/** Timeline rows key on friendly order_id (e.g. A001-001), not UUID. */
export async function expectTimelineEntry(
  friendlyOrderId: string,
  matcher: string | RegExp
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const { data } = await db
          .from("order_activity")
          .select("content, activity_type")
          .eq("order_id", friendlyOrderId)
          .eq("activity_type", "timeline")
          .order("created_at", { ascending: false })
          .limit(30);
        const contents = (data ?? []).map((r) => r.content ?? "");
        if (typeof matcher === "string") {
          return contents.some((c) => c.includes(matcher));
        }
        return contents.some((c) => matcher.test(c));
      },
      {
        timeout: pollTimeout,
        message: `timeline entry matching ${matcher}`,
      }
    )
    .toBe(true);
}

/**
 * With WhatsApp unconfigured, rows land as status "skipped" (or "pending"/"sent").
 * Assert that a notification was queued for the template key.
 */
export async function expectNotificationQueued(
  friendlyOrderId: string | null,
  templateKey: string,
  opts?: { enquiryId?: string }
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        let q = db
          .from("notification_outbox")
          .select("id, status, template_key")
          .ilike("template_key", `%${templateKey}%`);

        if (friendlyOrderId) {
          q = q.eq("order_id", friendlyOrderId);
        }
        if (opts?.enquiryId) {
          q = q.eq("enquiry_id", opts.enquiryId);
        }

        const { data } = await q.limit(5);
        return (data ?? []).length > 0 ? data![0].status : null;
      },
      {
        timeout: pollTimeout,
        message: `notification_outbox for ${templateKey}`,
      }
    )
    .toMatch(/^(pending|sent|skipped|failed)$/);
}

export async function expectCustomerExists(opts: {
  email?: string;
  phone?: string;
  name?: string;
}) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        let q = db
          .from("customers")
          .select("id, name, email, phone, customer_id")
          .eq("company_id", PRINTOMS_COMPANY_ID);

        if (opts.email) q = q.eq("email", opts.email);
        if (opts.phone) q = q.eq("phone", opts.phone);
        if (opts.name) q = q.eq("name", opts.name);

        const { data } = await q.maybeSingle();
        return data?.id ?? null;
      },
      { timeout: pollTimeout, message: "customer exists" }
    )
    .toBeTruthy();
}

export async function expectEnquiryExists(opts: {
  email?: string;
  phone?: string;
  status?: string;
}) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        let q = db
          .from("enquiries")
          .select("id, enquire_id, status, email, phone")
          .eq("company_id", PRINTOMS_COMPANY_ID)
          .order("date_received", { ascending: false })
          .limit(1);

        if (opts.email) q = q.eq("email", opts.email);
        if (opts.phone) q = q.eq("phone", opts.phone);

        const { data } = await q.maybeSingle();
        if (!data) return null;
        if (opts.status && data.status !== opts.status) return null;
        return data;
      },
      { timeout: pollTimeout, message: "enquiry exists" }
    )
    .toBeTruthy();
}

export async function expectQuotationStatus(
  orderUuid: string,
  status: string
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const { data } = await db
          .from("quotations")
          .select("status")
          .eq("order_id", orderUuid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.status ?? null;
      },
      { timeout: pollTimeout, message: `quotation status → ${status}` }
    )
    .toBe(status);
}

export async function expectDesignExists(orderUuid: string) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const { data } = await db
          .from("designs")
          .select("id, items")
          .eq("order_id", orderUuid)
          .maybeSingle();
        return data?.id ?? null;
      },
      { timeout: pollTimeout, message: "design row exists" }
    )
    .toBeTruthy();
}

export async function expectPortalTokenValid(opts: {
  customerId: string;
  orderId?: string;
}) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        let q = db
          .from("portal_access_tokens")
          .select("jti, revoked_at, expires_at")
          .eq("customer_id", opts.customerId)
          .is("revoked_at", null)
          .order("issued_at", { ascending: false })
          .limit(1);

        if (opts.orderId) q = q.eq("order_id", opts.orderId);

        const { data } = await q.maybeSingle();
        if (!data?.jti) return null;
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          return null;
        }
        return data.jti;
      },
      { timeout: pollTimeout, message: "valid portal token" }
    )
    .toBeTruthy();
}

export async function expectStorageObject(
  bucket: string,
  pathPrefix: string
) {
  const db = getServiceClient();
  await expect
    .poll(
      async () => {
        const { data } = await db.storage.from(bucket).list(pathPrefix, {
          limit: 20,
        });
        return (data ?? []).length;
      },
      {
        timeout: pollTimeout,
        message: `storage objects in ${bucket}/${pathPrefix}`,
      }
    )
    .toBeGreaterThan(0);
}

export async function getOrderByCustomerEmail(email: string) {
  const db = getServiceClient();
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("email", email)
    .eq("company_id", PRINTOMS_COMPANY_ID)
    .maybeSingle();
  if (!customer) return null;

  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("customer_id", customer.id)
    .order("date_created", { ascending: false })
    .limit(1)
    .maybeSingle();

  return order;
}

export async function getEnquiryByEmail(email: string) {
  const db = getServiceClient();
  const { data } = await db
    .from("enquiries")
    .select("*")
    .eq("email", email)
    .eq("company_id", PRINTOMS_COMPANY_ID)
    .order("date_received", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
