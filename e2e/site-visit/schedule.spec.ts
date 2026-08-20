import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { SiteVisitPage } from "../pages/SiteVisitPage";

test.describe("Site Visit Scheduling", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("admin schedules a site visit from the worksheet", async ({
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
      await siteVisit.scheduleVisit("123 Test Ave, Bengaluru");
    } finally {
      await cleanupByEmail(customer.email);
    }
  });

  test("Schedule Visit stays disabled until date, time, and address are set", async ({
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

      await page.getByRole("button", { name: "Schedule by yourself" }).click();
      await expect(page.getByRole("heading", { name: "Schedule Site Visit" })).toBeVisible();

      const submitBtn = page.getByRole("button", { name: "Schedule Visit" });
      const addressInput = page.getByPlaceholder(/Search address|Full address/i);
      await addressInput.fill("");
      await expect(submitBtn).toBeDisabled();
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
