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
import { mintPortalToken } from "../helpers/portal-token";
import { appPath } from "../helpers/paths";
import { seedOrderAtDesignInProgress } from "../helpers/stages";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { CustomerPortalPage } from "../pages/CustomerPortalPage";
import { DesignPage, localDatePlusDays } from "../pages/DesignPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";

/**
 * Design-stage approval layer, mirroring real usage:
 *   admin finishes site visit (Quote First) and writes the quote
 *   → designer uploads a proof and sends it
 *   → customer approves on the portal
 *   → designer uploads production files and requests admin approval
 *   → admin approves / rejects / auto-approves
 *
 * Also covers admin skipping customer design approval and starting
 * fabrication themselves.
 */
test.describe.configure({ timeout: 180_000 });

async function bringOrderToDesignInProgress(
  customer: ReturnType<typeof corporateCustomer>
): Promise<CreatedOrder> {
  return fromSeed(await seedOrderAtDesignInProgress(customer));
}

async function designerUploadProofAndSend(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder
) {
  const designerCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/designer.json",
  });
  const page = await designerCtx.newPage();
  try {
    const workspace = new OrderWorkspacePage(page);
    await workspace.gotoStaff(order.friendlyOrderId);
    const design = new DesignPage(page);
    await design.openTab();
    await design.uploadFirstProof();
    await design.sendToCustomer();
  } finally {
    await designerCtx.close();
  }
}

async function customerApproveDesign(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder
) {
  const { token } = await mintPortalToken({
    customerId: order.customerUuid,
    orderId: order.orderUuid,
  });
  const portalCtx = await browser.newContext({ baseURL });
  const portalPage = await portalCtx.newPage();
  try {
    const portal = new CustomerPortalPage(portalPage);
    await portal.gotoWithToken(token);
    await portal.approveDesign();
    await expectOrderStage(order.friendlyOrderId, "Design Approved");
  } finally {
    await portalCtx.close();
  }
}

async function designerUploadProductionAndRequest(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder,
  expected: { stage: string; stageStatus: string }
) {
  const designerCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/designer.json",
  });
  const page = await designerCtx.newPage();
  try {
    const workspace = new OrderWorkspacePage(page);
    await workspace.gotoStaff(order.friendlyOrderId);
    const design = new DesignPage(page);
    await design.openTab();
    await design.uploadProductionFile();
    await design.staffRequestAdvance();
    await expectStageStatus(order.friendlyOrderId, expected.stageStatus);
    await expectOrderStage(order.friendlyOrderId, expected.stage);
  } finally {
    await designerCtx.close();
  }
}

async function enableDesignAutoApprovalInSettings(
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
      name: "Toggle auto-approval for Design",
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
      .poll(async () => (await getWorkflowAutoApproval()).design, {
        timeout: 15_000,
        message: "design auto-approval persisted",
      })
      .toBe(true);
  } finally {
    await adminCtx.close();
  }
}

test.describe("Design: Approval Layer (full workflow)", () => {
  test.describe("Staff request → admin approves", () => {
    test("customer-approved design, staff request, admin starts fabrication → Production", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("design", false);

        const order = await bringOrderToDesignInProgress(customer);
        await designerUploadProofAndSend(browser, baseURL!, order);
        await customerApproveDesign(browser, baseURL!, order);
        await designerUploadProductionAndRequest(browser, baseURL!, order, {
          stage: "Design Approved",
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
          await adminWs.clickStartFabrication();
          await adminWs.confirmStartFabrication(localDatePlusDays(14));

          await expectOrderStage(order.friendlyOrderId, "Production");
          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectTimelineEntry(
            order.friendlyOrderId,
            /approved stage progression|from "Design Approved"/i
          );
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("design", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Staff request → admin rejects", () => {
    test("admin sends the design back to staff for revision", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("design", false);

        const order = await bringOrderToDesignInProgress(customer);
        await designerUploadProofAndSend(browser, baseURL!, order);
        await customerApproveDesign(browser, baseURL!, order);
        await designerUploadProductionAndRequest(browser, baseURL!, order, {
          stage: "Design Approved",
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
            "Please re-export the production file at 150 dpi and check the letter kerning."
          );

          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Design Approved");
          await expectTimelineEntry(order.friendlyOrderId, /requested changes/i);
        } finally {
          await adminCtx.close();
        }

        const designerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/designer.json",
        });
        const staffPage = await designerCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoStaff(order.friendlyOrderId);
          const design = new DesignPage(staffPage);
          await design.openTab();
          await expect(
            staffPage.getByRole("button", {
              name: /Request Admin Approval for Design Workflow|Request Approval/i,
            })
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await designerCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("design", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Auto-approval — toggle ON in Settings", () => {
    test("staff request auto-advances to Production; admin sees no pending", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("design", false);

        const order = await bringOrderToDesignInProgress(customer);
        await designerUploadProofAndSend(browser, baseURL!, order);
        await customerApproveDesign(browser, baseURL!, order);

        await enableDesignAutoApprovalInSettings(browser, baseURL!);

        await designerUploadProductionAndRequest(browser, baseURL!, order, {
          stage: "Production",
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
        await setWorkflowAutoApprovalStage("design", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Admin completes the design and advances", () => {
    test("admin skips customer approval, then starts fabrication → Production", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("design", false);

        const order = await bringOrderToDesignInProgress(customer);

        await designerUploadProofAndSend(browser, baseURL!, order);

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          const design = new DesignPage(adminPage);
          await design.openTab();
          await design.adminSkipCustomerApproval();

          await expectOrderStage(order.friendlyOrderId, "Design Approved");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx.close();
        }

        const designerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/designer.json",
        });
        const designerPage = await designerCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(designerPage);
          await workspace.gotoStaff(order.friendlyOrderId);
          const design = new DesignPage(designerPage);
          await design.openTab();
          await design.uploadProductionFile();
        } finally {
          await designerCtx.close();
        }

        const adminCtx2 = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage2 = await adminCtx2.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage2);
          await admin.openOrder(order.friendlyOrderId);
          const design = new DesignPage(adminPage2);
          await design.openTab();
          await design.adminStartFabrication();

          await expectOrderStage(order.friendlyOrderId, "Production");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx2.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("design", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });
});
