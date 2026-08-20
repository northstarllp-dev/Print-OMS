import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { getServiceClient } from "../helpers/db";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { SiteVisitPage } from "../pages/SiteVisitPage";

test.describe("Site Visit: Measurements & Sign Items", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("add two sign items, set sizes and scaffolding, save draft, reload", async ({
    browser,
    baseURL,
    page,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await createOrderAtSiteVisit(customer);
      const admin = new AdminOrdersPage(page);
      await admin.openOrder(order.friendlyOrderId);

      const siteVisit = new SiteVisitPage(page);
      await siteVisit.openTab();
      await siteVisit.skipVisit(customer.location);

      await siteVisit.addItem();
      await siteVisit.fillActiveItemMeasurements(
        "12",
        "4",
        "Front facade LED illuminated board"
      );

      await siteVisit.addItem(/Item-2/i);
      await page.getByRole("button", { name: /Item-2/i }).click();
      await siteVisit.fillActiveItemMeasurements("6", "3");
      await siteVisit.setScaffoldingRequired();
      await siteVisit.saveDraft();

      const db = getServiceClient();
      const { data: sv } = await db
        .from("site_visits")
        .select("*, site_visit_measurements(*)")
        .eq("order_id", order.orderUuid)
        .single();

      expect(sv).toBeTruthy();
      expect(sv.scaffolding_required).toBe(true);
      expect(sv.site_visit_measurements.length).toBeGreaterThanOrEqual(2);

      await page.reload();
      await siteVisit.openTab();
      await expect(page.getByRole("button", { name: /Item-1/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Item-2/i })).toBeVisible();
    } finally {
      await cleanupByEmail(customer.email);
    }
  });

  test("remove a sign item from the item tabs", async ({
    browser,
    baseURL,
    page,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await createOrderAtSiteVisit(customer);
      const admin = new AdminOrdersPage(page);
      await admin.openOrder(order.friendlyOrderId);

      const siteVisit = new SiteVisitPage(page);
      await siteVisit.openTab();
      await siteVisit.skipVisit(customer.location);
      await siteVisit.addItem();
      await siteVisit.addItem(/Item-2/i);

      await siteVisit.removeLastItem();
      await expect(page.getByRole("button", { name: /Item-2/i })).not.toBeVisible();
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
