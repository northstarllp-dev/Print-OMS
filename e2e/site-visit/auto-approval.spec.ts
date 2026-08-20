import { test } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { SiteVisitPage } from "../pages/SiteVisitPage";

test.describe("Site Visit: Auto-Approval", () => {
  test("staff request auto-advances to Quotation when site_visit toggle is ON", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      previousSetting = await setWorkflowAutoApprovalStage("site_visit", true);

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
        await siteVisit.skipVisit(customer.location);
        await siteVisit.addItem();
        await siteVisit.fillActiveItemMeasurements("12", "6");
        await siteVisit.staffRequestAdminApproval();

        // Auto-approval: stage_status stays Normal and stage advances
        // directly to Quotation In Progress (default quote_first).
        await expectStageStatus(order.friendlyOrderId, "Normal");
        await expectOrderStage(order.friendlyOrderId, "Quotation In Progress");
        await expectTimelineEntry(
          order.friendlyOrderId,
          /Auto-approved/i
        );
      } finally {
        await marketerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("site_visit", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });

  test("staff request parks in Pending Admin Approval when toggle is OFF", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
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
        await siteVisit.skipVisit(customer.location);
        await siteVisit.addItem();
        await siteVisit.fillActiveItemMeasurements("12", "6");
        await siteVisit.staffRequestAdminApproval();

        // Existing behavior: pending admin approval, stage unchanged.
        await expectStageStatus(
          order.friendlyOrderId,
          "Pending Admin Approval: Site Visit Completed"
        );
      } finally {
        await marketerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("site_visit", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });
});

