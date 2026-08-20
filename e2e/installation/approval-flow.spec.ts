import { test, expect, type Browser } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { fromSeed, type CreatedOrder } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import {
  getWorkflowAutoApproval,
  setWorkflowAutoApprovalStage,
} from "../helpers/settings";
import { appPath } from "../helpers/paths";
import { seedOrderAtInstallationScheduled } from "../helpers/stages";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { InstallationPage } from "../pages/InstallationPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

/**
 * Installation-stage approval layer, mirroring real usage:
 *   order reaches Ready For Installation through the earlier stages
 *   → installer schedules the visit
 *   → installer ticks the field checklist and submits job-done
 *   → admin reviews payments and completes / rejects / auto-approves
 *
 * Also covers admin scheduling + completing the order themselves.
 */
test.describe.configure({ timeout: 180_000 });

async function bringOrderToInstallationScheduled(
  customer: ReturnType<typeof corporateCustomer>
): Promise<CreatedOrder> {
  return fromSeed(await seedOrderAtInstallationScheduled(customer));
}

async function installerSubmitJobDone(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder,
  expected: { stage: string; stageStatus: string }
) {
  const instCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/installation.json",
  });
  const page = await instCtx.newPage();
  try {
    const workspace = new OrderWorkspacePage(page);
    await workspace.gotoInstallation(order.friendlyOrderId);
    const installation = new InstallationPage(page);
    await installation.openTab();
    await installation.completeChecklist();
    await installation.staffRequestJobDone();
    await expectStageStatus(order.friendlyOrderId, expected.stageStatus);
    await expectOrderStage(order.friendlyOrderId, expected.stage);
  } finally {
    await instCtx.close();
  }
}

async function enableInstallationAutoApprovalInSettings(
  browser: Browser,
  baseURL: string
) {
  const adminCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/admin.json",
  });
  const page = await adminCtx.newPage();
  try {
    await page.goto(appPath("/admin/settings"));
    await expect(page.getByText("Workflow Approvals")).toBeVisible({
      timeout: 15_000,
    });

    const toggle = page.getByRole("button", {
      name: "Toggle auto-approval for Installation",
    });
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
    }

    const saveNow = page.getByRole("button", { name: /Save Now/i });
    if (await saveNow.isVisible().catch(() => false)) {
      await saveNow.click();
    } else {
      await page.getByRole("button", { name: /Save Settings/i }).click();
    }
    await expect(page.getByText(/Settings Saved/i)).toBeVisible({
      timeout: 15_000,
    });

    await expect
      .poll(async () => (await getWorkflowAutoApproval()).installation, {
        timeout: 15_000,
        message: "installation auto-approval persisted",
      })
      .toBe(true);
  } finally {
    await adminCtx.close();
  }
}

test.describe("Installation: Approval Layer (full workflow)", () => {
  test.describe("Staff request → admin approves", () => {
    test("job-done request, admin reviews payments and completes the order", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage(
          "installation",
          false
        );

        const order = await bringOrderToInstallationScheduled(customer);
        await installerSubmitJobDone(browser, baseURL!, order, {
          stage: "Installation Scheduled",
          stageStatus: "Pending Admin Approval: Job Done",
        });

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);

          await expect(adminPage.getByText("Pending Approval")).toBeVisible({
            timeout: 10_000,
          });

          const adminWs = new OrderWorkspacePage(adminPage);
          await adminWs.openAdminControls();
          await expect(adminPage.getByText("Pending Stage Approval")).toBeVisible(
            { timeout: 10_000 }
          );
          await adminWs.clickReviewPaymentsAndComplete();

          const installation = new InstallationPage(adminPage);
          await installation.confirmPaymentsAndComplete();

          await expectOrderStage(order.friendlyOrderId, "Completed");
          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectTimelineEntry(
            order.friendlyOrderId,
            /approved stage progression|from "Installation Scheduled"|Completed/i
          );
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("installation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Staff request → admin rejects", () => {
    test("admin sends the installation back to the field team", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage(
          "installation",
          false
        );

        const order = await bringOrderToInstallationScheduled(customer);
        await installerSubmitJobDone(browser, baseURL!, order, {
          stage: "Installation Scheduled",
          stageStatus: "Pending Admin Approval: Job Done",
        });

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          await expect(adminPage.getByText("Pending Approval")).toBeVisible({
            timeout: 10_000,
          });

          const adminWs = new OrderWorkspacePage(adminPage);
          await adminWs.openAdminControls();
          await adminWs.adminRequestChanges(
            "The fascia is not level — please remount and send after-photos."
          );

          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Installation Scheduled");
          await expectTimelineEntry(order.friendlyOrderId, /requested changes/i);
        } finally {
          await adminCtx.close();
        }

        const instCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/installation.json",
        });
        const staffPage = await instCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoInstallation(order.friendlyOrderId);
          const installation = new InstallationPage(staffPage);
          await installation.openTab();
          await expect(
            staffPage.getByRole("button", {
              name: /Request Admin Approval for Field Installation|Request Approval/i,
            })
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await instCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("installation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Auto-approval — toggle ON in Settings", () => {
    test("job-done auto-completes when payment is settled; admin sees no pending", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage(
          "installation",
          false
        );

        const order = await bringOrderToInstallationScheduled(customer);

        const payCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const payPage = await payCtx.newPage();
        try {
          const admin = new AdminOrdersPage(payPage);
          await admin.openOrder(order.friendlyOrderId);
          const installation = new InstallationPage(payPage);
          await installation.recordOutstandingAsReceived();
        } finally {
          await payCtx.close();
        }

        await enableInstallationAutoApprovalInSettings(browser, baseURL!);

        await installerSubmitJobDone(browser, baseURL!, order, {
          stage: "Completed",
          stageStatus: "Normal",
        });
        await expectTimelineEntry(order.friendlyOrderId, /auto-approved/i);

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          await expect(
            adminPage.getByText("Pending Stage Approval")
          ).not.toBeVisible({ timeout: 10_000 });
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("installation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Admin completes installation and advances", () => {
    test("admin reviews payments and completes without a staff request", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage(
          "installation",
          false
        );

        const order = await bringOrderToInstallationScheduled(customer);

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          const installation = new InstallationPage(adminPage);
          await installation.openTab();
          await adminPage
            .getByRole("button", { name: /Review Payments & Complete/i })
            .click();
          await installation.confirmPaymentsAndComplete();

          await expectOrderStage(order.friendlyOrderId, "Completed");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("installation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });
});
