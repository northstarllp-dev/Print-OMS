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
import { seedOrderAtProduction } from "../helpers/stages";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { ProductionPage } from "../pages/ProductionPage";

/**
 * Production-stage approval layer, mirroring real usage:
 *   admin takes the order through site visit, quote, and design
 *   → production staff complete the workshop checklist
 *   → staff request admin approval to leave Production
 *   → admin approves / rejects / auto-approves
 *
 * Also covers admin completing the checklist themselves and advancing
 * without a staff request.
 */
test.describe.configure({ timeout: 180_000 });

async function bringOrderToProduction(
  customer: ReturnType<typeof corporateCustomer>
): Promise<CreatedOrder> {
  return fromSeed(
    await seedOrderAtProduction(customer, { checklistComplete: false })
  );
}

async function productionStaffCompleteAndRequest(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder,
  expected: { stage: string; stageStatus: string }
) {
  const prodCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/production.json",
  });
  const page = await prodCtx.newPage();
  try {
    const workspace = new OrderWorkspacePage(page);
    await workspace.gotoProduction(order.friendlyOrderId);
    const production = new ProductionPage(page);
    await production.openTab();
    await production.completeAllChecklist();
    await production.staffRequestAdvance();
    await expectStageStatus(order.friendlyOrderId, expected.stageStatus);
    await expectOrderStage(order.friendlyOrderId, expected.stage);
  } finally {
    await prodCtx.close();
  }
}

async function enableProductionAutoApprovalInSettings(
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
      name: "Toggle auto-approval for Production",
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
      .poll(async () => (await getWorkflowAutoApproval()).production, {
        timeout: 15_000,
        message: "production auto-approval persisted",
      })
      .toBe(true);
  } finally {
    await adminCtx.close();
  }
}

test.describe("Production: Approval Layer (full workflow)", () => {
  test.describe("Staff request → admin approves", () => {
    test("checklist complete, staff request, admin Approve Stage → Ready For Installation", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("production", false);

        const order = await bringOrderToProduction(customer);
        await productionStaffCompleteAndRequest(browser, baseURL!, order, {
          stage: "Production",
          stageStatus: "Pending Admin Approval: Production Ready",
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
          await expect(adminPage.getByText("Pending Stage Approval")).toBeVisible({
            timeout: 10_000,
          });
          await adminWs.clickApproveStage();

          await expectOrderStage(order.friendlyOrderId, "Ready For Installation");
          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectTimelineEntry(
            order.friendlyOrderId,
            /approved stage progression|from "Production"/i
          );
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("production", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Staff request → admin rejects", () => {
    test("admin sends production back to the floor for revision", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("production", false);

        const order = await bringOrderToProduction(customer);
        await productionStaffCompleteAndRequest(browser, baseURL!, order, {
          stage: "Production",
          stageStatus: "Pending Admin Approval: Production Ready",
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
            "Quality check photos are missing please recut the ACP edge and re-QC."
          );

          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Production");
          await expectTimelineEntry(order.friendlyOrderId, /requested changes/i);
        } finally {
          await adminCtx.close();
        }

        const prodCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/production.json",
        });
        const staffPage = await prodCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoProduction(order.friendlyOrderId);
          const production = new ProductionPage(staffPage);
          await production.openTab();
          await expect(
            staffPage.getByRole("button", {
              name: /Request Admin Approval for Fabrication Checklist|Request Approval/i,
            })
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await prodCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("production", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Auto-approval toggle ON in Settings", () => {
    test("staff request auto-advances to Ready For Installation; admin sees no pending", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("production", false);

        const order = await bringOrderToProduction(customer);

        await enableProductionAutoApprovalInSettings(browser, baseURL!);

        await productionStaffCompleteAndRequest(browser, baseURL!, order, {
          stage: "Ready For Installation",
          stageStatus: "Normal",
        });
        await expectTimelineEntry(order.friendlyOrderId, /Auto-approved/i);

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
        await setWorkflowAutoApprovalStage("production", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Admin completes production and advances", () => {
    test("admin ticks the checklist, then Approve & Advance → Ready For Installation", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("production", false);

        const order = await bringOrderToProduction(customer);

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          const production = new ProductionPage(adminPage);
          await production.openTab();
          await production.completeAllChecklist();
          await production.adminApproveAndAdvance();

          await expectOrderStage(order.friendlyOrderId, "Ready For Installation");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("production", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });
});
