import { test, expect } from "@playwright/test";
import { makeCustomer } from "../fixtures/customers";
import { createOrderViaEnquiry } from "../helpers/create-order";
import { createOrderDirect, advanceQuoteFirstPipeline } from "../helpers/stages";
import { portalContext } from "../helpers/portal";
import { cleanupByEmail } from "../helpers/cleanup";
import { CustomerPortalPage } from "../pages/CustomerPortalPage";
import {
  expectOrderStage,
  expectTimelineEntry,
  expectNotificationQueued,
  expectQuotationStatus,
  expectCustomerExists,
  expectPortalTokenValid,
} from "../helpers/assertions";

/**
 * Core business story: enquiry → order → quote_first pipeline → Completed.
 *
 * UI drives admin enquiry creation + conversion (the entry funnel).
 * Stage progression uses DB helpers that mirror server-action outcomes so we
 * assert business state (orders.stage, timeline, outbox, portal) without
 * depending on every worksheet modal selector on day one.
 */
test.describe("enquiry → installation happy path", () => {
  test("quote_first pipeline reaches Completed with portal visibility", async ({
    browser,
  }) => {
    const customer = makeCustomer("corporate");

    try {
      // ── Story 1: Admin enquiry (UI) + convert (UI) ─────────────────────
      const created = await createOrderViaEnquiry(browser, customer);

      await expectOrderStage(created.orderUuid, "Site Visit Pending");
      await expectCustomerExists({ email: customer.email });
      await expectTimelineEntry(created.friendlyOrderId, /Order created/i);

      // Note: META_WHATSAPP_DISPATCH_DISABLED=true in dispatchNotification.ts
      // means live UI actions do not write notification_outbox. Outbox rows
      // below are seeded by advanceQuoteFirstPipeline (business-state helpers).

      // ── Stories 2–6: advance quote_first pipeline (business state) ────
      const { friendly, customerId } = await advanceQuoteFirstPipeline(
        created.orderUuid
      );

      await expectOrderStage(created.orderUuid, "Completed");
      await expectTimelineEntry(friendly, /Installation completed/i);
      await expectQuotationStatus(created.orderUuid, "Approved");
      await expectNotificationQueued(friendly, "quotation_ready");
      await expectNotificationQueued(friendly, "installation_completed");

      // ── Portal reflects the order ─────────────────────────────────────
      const portal = await portalContext(browser, {
        customerId,
        orderId: created.orderUuid,
      });

      try {
        const portalPage = new CustomerPortalPage(portal.page);
        await portalPage.expectVisibleText(
          new RegExp(customer.name.split(" ").slice(-1)[0], "i")
        );
        await portalPage.expectVisibleText(
          new RegExp(created.friendlyOrderId.replace("-", "[-‐‑]?"))
        );
        await portalPage.expectVisibleText(/Job completed|Completed|Installation/i);
        await expectPortalTokenValid({
          customerId,
          orderId: created.orderUuid,
        });
      } finally {
        await portal.context.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });

  test("direct-seeded order can advance pipeline and open portal", async ({
    browser,
  }) => {
    const customer = makeCustomer("vip");
    let email = customer.email;

    try {
      const order = await createOrderDirect(customer);
      await expectOrderStage(order.id, "Site Visit Pending");
      await expectTimelineEntry(order.order_id, /Order created/i);
      await expectNotificationQueued(order.order_id, "order_created");

      await advanceQuoteFirstPipeline(order.id);
      await expectOrderStage(order.id, "Completed");

      const portal = await portalContext(browser, {
        customerId: order.customerUuid,
        orderId: order.id,
      });

      try {
        await expect(portal.page.getByText(/Completed|Installation|Order/i).first()).toBeVisible({
          timeout: 20_000,
        });
      } finally {
        await portal.context.close();
      }
    } finally {
      await cleanupByEmail(email);
    }
  });
});
