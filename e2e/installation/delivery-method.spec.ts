import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import { expectOrderStage, expectTimelineEntry } from "../helpers/assertions";
import { seedOrderAtReadyForInstallation } from "../helpers/stages";
import { InstallationPage } from "../pages/InstallationPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

test.describe("Installation: delivery method", () => {
  test("chooser can continue to Schedule Installation", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await seedOrderAtReadyForInstallation(customer);

      const instCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/installation.json",
      });
      const page = await instCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(page);
        await workspace.gotoInstallation(order.order_id);
        const installation = new InstallationPage(page);
        await installation.openDeliveryChooser();
        await page.getByRole("button", { name: /Schedule Installation/i }).click();
        await expect(
          page.getByRole("heading", { name: "Installation Schedule", exact: true })
        ).toBeVisible({ timeout: 15_000 });
        await expectOrderStage(order.order_id, "Ready For Installation");
      } finally {
        await instCtx.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });

  test("customer pickup completes the order after collection", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await seedOrderAtReadyForInstallation(customer);

      const instCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/installation.json",
      });
      const page = await instCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(page);
        await workspace.gotoInstallation(order.order_id);
        const installation = new InstallationPage(page);
        await installation.chooseCustomerPickup();
        await expectOrderStage(order.order_id, "Customer Pickup");
        await expectTimelineEntry(order.order_id, /Customer Pickup/i);

        await installation.confirmCustomerCollected();
        await expectOrderStage(order.order_id, "Completed");
        await expect(
          page.getByRole("heading", { name: /Pickup Confirmed/i })
        ).toBeVisible();
      } finally {
        await instCtx.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
