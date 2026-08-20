import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { getServiceClient, PRINTOMS_COMPANY_ID } from "../helpers/db";
import { appPath } from "../helpers/paths";
import { expectOrderStage } from "../helpers/assertions";
import { mintPortalToken } from "../helpers/portal-token";

test.describe("Site Visit: App Settings & Portal Self-Scheduling", () => {
  test("portal shows pending message when self-scheduling is off", async ({
    browser,
    baseURL,
    page,
  }) => {
    const db = getServiceClient();
    const { data: before } = await db
      .from("app_settings")
      .select("site_visit_scheduling_enabled")
      .eq("company_id", PRINTOMS_COMPANY_ID)
      .maybeSingle();
    const previous = before?.site_visit_scheduling_enabled ?? true;

    const customer = corporateCustomer();
    try {
      await db
        .from("app_settings")
        .update({ site_visit_scheduling_enabled: false })
        .eq("company_id", PRINTOMS_COMPANY_ID);

      const order = await createOrderAtSiteVisit(customer);
      const { token } = await mintPortalToken({
        customerId: order.customerUuid,
        orderId: order.orderUuid,
      });

      await page.goto(appPath(`/portal?token=${token}`));
      await expect(
        page.getByText(/Your site visit schedule is pending confirmation from our team/i)
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("button", { name: /Confirm Site Visit/i })
      ).not.toBeVisible();
    } finally {
      await db
        .from("app_settings")
        .update({ site_visit_scheduling_enabled: previous })
        .eq("company_id", PRINTOMS_COMPANY_ID);
      await cleanupByEmail(customer.email);
    }
  });

  test("customer books a site visit from the portal when self-scheduling is on", async ({
    browser,
    baseURL,
    page,
  }) => {
    const db = getServiceClient();
    await db
      .from("app_settings")
      .update({ site_visit_scheduling_enabled: true })
      .eq("company_id", PRINTOMS_COMPANY_ID);

    const customer = corporateCustomer();
    try {
      const order = await createOrderAtSiteVisit(customer);
      const { token } = await mintPortalToken({
        customerId: order.customerUuid,
        orderId: order.orderUuid,
      });

      await page.goto(appPath(`/portal?token=${token}`));
      await expect(
        page.getByRole("heading", { name: /Schedule Your Physical Site Audit/i })
      ).toBeVisible({ timeout: 15_000 });

      await page.locator(".date-scroll button").first().click();
      await page.getByRole("button", { name: "10 AM - 11 AM" }).click();
      await page
        .getByPlaceholder(/Search address|Full address/i)
        .first()
        .fill("77 Portal Road, Koramangala");
      await page.getByRole("button", { name: /Confirm Site Visit/i }).click();

      await expect(page.getByText(/Site Visit Scheduled/i)).toBeVisible({
        timeout: 15_000,
      });
      await expectOrderStage(order.friendlyOrderId, "Site Visit Scheduled");
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
