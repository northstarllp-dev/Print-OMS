import { test } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { seedOrderAtProduction, uiRequestApproval } from "../helpers/stages";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

test.describe("Production: Auto-Approval", () => {
  test("staff request auto-advances to Ready For Installation when production toggle is ON", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      previousSetting = await setWorkflowAutoApprovalStage("production", true);

      const order = await seedOrderAtProduction(customer);

      const prodCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/production.json",
      });
      const staffPage = await prodCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Production");

        await uiRequestApproval(staffPage);

        // Auto-approval: stage_status stays Normal and stage advances
        // directly to Ready For Installation. The checklist gate still
        // applies (seeded complete above).
        await expectStageStatus(order.order_id, "Normal");
        await expectOrderStage(order.order_id, "Ready For Installation");
        await expectTimelineEntry(order.order_id, /Auto-approved/i);
      } finally {
        await prodCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("production", previousSetting);
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
      previousSetting = await setWorkflowAutoApprovalStage("production", false);

      const order = await seedOrderAtProduction(customer);

      const prodCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/production.json",
      });
      const staffPage = await prodCtx.newPage();
      try {
        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Production");

        await uiRequestApproval(staffPage);

        // Existing behavior: pending admin approval, stage unchanged.
        await expectStageStatus(
          order.order_id,
          "Pending Admin Approval: Production Ready"
        );
        await expectOrderStage(order.order_id, "Production");
      } finally {
        await prodCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("production", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });
});
