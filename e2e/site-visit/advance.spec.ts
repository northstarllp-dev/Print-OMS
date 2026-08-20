import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { expectOrderStage } from "../helpers/assertions";
import { getServiceClient } from "../helpers/db";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { SiteVisitPage } from "../pages/SiteVisitPage";

test.describe("Site Visit: Stage Advancement & Workflow Selection", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("admin skip + measurements then Quote First advances to Quotation", async ({
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
      await siteVisit.fillActiveItemMeasurements("15", "5");
      await siteVisit.adminLockAndChooseWorkflow("quote_first");

      await expectOrderStage(order.friendlyOrderId, "Quotation In Progress");

      const db = getServiceClient();
      const { data: sv } = await db
        .from("site_visits")
        .select("completed")
        .eq("order_id", order.orderUuid)
        .single();
      expect(sv?.completed).toBe(true);
    } finally {
      await cleanupByEmail(customer.email);
    }
  });

  test("admin skip + measurements then Design First advances to Design", async ({
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
      await siteVisit.fillActiveItemMeasurements("20", "8");
      await siteVisit.adminLockAndChooseWorkflow("design_first");

      await expectOrderStage(order.friendlyOrderId, "Design In Progress");
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
