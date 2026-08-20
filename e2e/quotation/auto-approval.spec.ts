import { test } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { seedOrderAtQuotationApproved } from "../helpers/stages";
import { uiRequestApproval } from "../helpers/stages";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

test.describe("Quotation: Auto-Approval", () => {
  test("staff request auto-advances to Design when quotation toggle is ON", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      previousSetting = await setWorkflowAutoApprovalStage("quotation", true);

      const order = await seedOrderAtQuotationApproved(customer);

      const marketerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/marketer.json",
      });
      const staffPage = await marketerCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Quote");

        await uiRequestApproval(staffPage, /Request Advance to/i);

        // Auto-approval: stage_status stays Normal and stage advances
        // directly to Design In Progress (quote_first).
        await expectStageStatus(order.order_id, "Normal");
        await expectOrderStage(order.order_id, "Design In Progress");
        await expectTimelineEntry(order.order_id, /Auto-approved/i);
      } finally {
        await marketerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("quotation", previousSetting);
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
      previousSetting = await setWorkflowAutoApprovalStage("quotation", false);

      const order = await seedOrderAtQuotationApproved(customer);

      const marketerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/marketer.json",
      });
      const staffPage = await marketerCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Quote");

        await uiRequestApproval(staffPage, /Request Advance to/i);

        // Existing behavior: pending admin approval, stage unchanged.
        await expectStageStatus(
          order.order_id,
          "Pending Admin Approval: Design Stage"
        );
        await expectOrderStage(order.order_id, "Quotation Approved");
      } finally {
        await marketerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("quotation", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });
});
