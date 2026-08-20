import { test, expect, type Page } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

/**
 * Bottom-right green FAB is the customer WhatsApp catch-up picker
 * (not internal chat). It must be available to both admin and staff.
 */
async function expectCustomerMessageFabFlow(page: Page) {
  const workspace = new OrderWorkspacePage(page);
  await workspace.openCustomerMessageFab();
  await workspace.pickCustomerMessageTemplate(/Order Created/);
  await expect(
    page.getByRole("heading", { name: /Order Created — Customer Message/i })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /WhatsApp/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy/i })).toBeVisible();
  await workspace.dismissCustomerMessageIfPresent();
  await expect(
    page.getByRole("button", { name: "Send customer WhatsApp message" })
  ).toBeVisible();
}

test.describe("Order worksheet: customer message FAB", () => {
  test("admin and staff can open the bottom-right WhatsApp catch-up", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await createOrderAtSiteVisit(customer);

      const adminCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/admin.json",
      });
      const adminPage = await adminCtx.newPage();
      try {
        const admin = new AdminOrdersPage(adminPage);
        await admin.openOrder(order.friendlyOrderId);
        await expectCustomerMessageFabFlow(adminPage);
      } finally {
        await adminCtx.close();
      }

      const staffCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/marketer.json",
      });
      const staffPage = await staffCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.friendlyOrderId);
        await expectCustomerMessageFabFlow(staffPage);
      } finally {
        await staffCtx.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
