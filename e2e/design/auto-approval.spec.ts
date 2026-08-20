import { test } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { seedOrderAtDesignApproved, uiRequestApproval } from "../helpers/stages";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

test.describe("Design: Auto-Approval", () => {
  test("staff request auto-advances to Production when design toggle is ON", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      previousSetting = await setWorkflowAutoApprovalStage("design", true);

      const order = await seedOrderAtDesignApproved(customer);

      const designerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/designer.json",
      });
      const staffPage = await designerCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Design");

        await uiRequestApproval(staffPage);

        // Auto-approval: stage_status stays Normal and stage advances
        // directly to Production (quote_first). A default installation
        // deadline is set on the productions row.
        await expectStageStatus(order.order_id, "Normal");
        await expectOrderStage(order.order_id, "Production");
        await expectTimelineEntry(order.order_id, /Auto-approved/i);
      } finally {
        await designerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("design", previousSetting);
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
      previousSetting = await setWorkflowAutoApprovalStage("design", false);

      const order = await seedOrderAtDesignApproved(customer);

      const designerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/designer.json",
      });
      const staffPage = await designerCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Design");

        await uiRequestApproval(staffPage);

        // Existing behavior: pending admin approval, stage unchanged.
        await expectStageStatus(
          order.order_id,
          "Pending Admin Approval: Production Ready"
        );
        await expectOrderStage(order.order_id, "Design Approved");
      } finally {
        await designerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("design", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });
});
