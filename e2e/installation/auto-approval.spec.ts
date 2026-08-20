import { test } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { seedOrderAtInstallationScheduled } from "../helpers/stages";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

test.describe("Installation: Auto-Approval", () => {
  test("staff request auto-advances to Completed when installation toggle is ON", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    let previousSetting = false;
    try {
      previousSetting = await setWorkflowAutoApprovalStage("installation", true);

      const order = await seedOrderAtInstallationScheduled(customer);

      const installerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/installation.json",
      });
      const staffPage = await installerCtx.newPage();
      try {
        // handleRequestAdvancement shows a native window.confirm before
        // marking the installation complete.
        staffPage.on("dialog", (d) => d.accept().catch(() => {}));

        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Installation");

        // The installation tab uses a native window.confirm (handled above),
        // not a UI confirm modal — click the request button directly.
        await staffPage
          .getByRole("button", { name: /Request Admin Approval/i })
          .first()
          .click();

        // Auto-approval: stage_status stays Normal and stage advances
        // directly to Completed. The payment-balance gate still applies
        // (seeded a received payment that zeroes the balance above).
        await expectStageStatus(order.order_id, "Normal");
        await expectOrderStage(order.order_id, "Completed");
        await expectTimelineEntry(order.order_id, /auto-approved/i);
      } finally {
        await installerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("installation", previousSetting);
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
      previousSetting = await setWorkflowAutoApprovalStage("installation", false);

      const order = await seedOrderAtInstallationScheduled(customer);

      const installerCtx = await browser.newContext({
        baseURL,
        storageState: "e2e/.auth/installation.json",
      });
      const staffPage = await installerCtx.newPage();
      try {
        staffPage.on("dialog", (d) => d.accept().catch(() => {}));

        const workspace = new OrderWorkspacePage(staffPage);
        await workspace.gotoStaff(order.order_id);
        await workspace.openStageTab("Installation");

        await staffPage
          .getByRole("button", { name: /Request Admin Approval/i })
          .first()
          .click();

        // Existing behavior: pending admin approval, stage unchanged.
        await expectStageStatus(
          order.order_id,
          "Pending Admin Approval: Job Done"
        );
        await expectOrderStage(order.order_id, "Installation Scheduled");
      } finally {
        await installerCtx.close();
      }
    } finally {
      await setWorkflowAutoApprovalStage("installation", previousSetting);
      await cleanupByEmail(customer.email);
    }
  });
});
