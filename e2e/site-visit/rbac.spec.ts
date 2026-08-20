import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import { expectStageStatus } from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { SiteVisitPage } from "../pages/SiteVisitPage";
import { appPath } from "../helpers/paths";

test.describe("Site Visit: Role-Based Access Control (RBAC)", () => {
  test("marketer can skip, measure, and request admin approval", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      // Guard against the auto-approval toggle leaking ON from another test.
      previousSetting = await setWorkflowAutoApprovalStage("site_visit", false);

      const order = await createOrderAtSiteVisit(customer);

      const marketerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/marketer.json",
      });
      const staffPage = await marketerCtx.newPage();

      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.friendlyOrderId);

        const siteVisit = new SiteVisitPage(staffPage);
        await siteVisit.openTab();

        await expect(
          staffPage.getByRole("button", { name: /Admin Controls/i })
        ).not.toBeVisible();
        await expect(staffPage.getByText(/Admin God Mode/i)).not.toBeVisible();

        await siteVisit.skipVisit(customer.location);
        await siteVisit.addItem();
        await siteVisit.fillActiveItemMeasurements("10", "5");
        await siteVisit.staffRequestAdminApproval();

        await expectStageStatus(
          order.friendlyOrderId,
          "Pending Admin Approval: Site Visit Completed"
        );
      } finally {
        await marketerCtx.close();
      }

      const adminCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/admin.json",
      });
      const adminPage = await adminCtx.newPage();

      try {
        const adminOrders = new AdminOrdersPage(adminPage);
        await adminOrders.openOrder(order.friendlyOrderId);

        await expect(adminPage.getByText("Pending Approval")).toBeVisible({
          timeout: 10_000,
        });
        await adminPage.getByRole("button", { name: /Admin Controls/i }).click();
        await expect(
          adminPage.getByRole("button", { name: /Choose Workflow & Approve/i })
        ).toBeVisible();

        await adminPage
          .getByRole("button", { name: /Choose Workflow & Approve/i })
          .click();
        const customerMsg = adminPage.getByRole("heading", {
          name: /Customer Message/i,
        });
        if (await customerMsg.isVisible({ timeout: 4_000 }).catch(() => false)) {
          await adminPage.getByRole("button", { name: /^Close/i }).click();
        }
        await expect(
          adminPage.getByRole("heading", { name: /Choose Workflow Path/i })
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await adminCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("site_visit", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });

  test("production staff cannot open a site-visit order from the production portal", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    try {
      const order = await createOrderAtSiteVisit(customer);

      const prodCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/production.json",
      });
      const prodPage = await prodCtx.newPage();

      try {
        await prodPage.goto(appPath(`/production/orders/${order.friendlyOrderId}`));
        await expect(prodPage).toHaveURL(/\/production\/orders\/?(\?|$)/, {
          timeout: 20_000,
        });
        await expect(
          prodPage.getByRole("button", { name: "Skip Visit & Add Values" })
        ).not.toBeVisible();
      } finally {
        await prodCtx.close();
      }
    } finally {
      await cleanupByEmail(customer.email);
    }
  });
});
