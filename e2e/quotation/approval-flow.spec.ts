import { test, expect, type Browser } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { fromSeed, type CreatedOrder } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectQuotationStatus,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import {
  getWorkflowAutoApproval,
  setWorkflowAutoApprovalStage,
} from "../helpers/settings";
import { mintPortalToken } from "../helpers/portal-token";
import { appPath } from "../helpers/paths";
import { seedOrderAtQuotationInProgress } from "../helpers/stages";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { CustomerPortalPage } from "../pages/CustomerPortalPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { QuotationPage } from "../pages/QuotationPage";

/**
 * Quotation-stage approval layer, mirroring real usage:
 *   admin finishes site visit (Quote First)
 *   → staff writes and sends the quote
 *   → customer approves on the portal
 *   → staff requests admin approval to leave Quotation
 *   → admin approves / rejects / auto-approves
 *
 * Also covers admin writing the quote themselves and advancing
 * without waiting for the customer.
 */
async function bringOrderToQuotationInProgress(
  customer: ReturnType<typeof corporateCustomer>
): Promise<CreatedOrder> {
  return fromSeed(await seedOrderAtQuotationInProgress(customer));
}

async function staffWriteAndSendQuote(
  browser: Browser,
  baseURL: string,
  order: CreatedOrder
) {
  const marketerCtx = await browser.newContext({
    baseURL,
    storageState: "e2e/.auth/marketer.json",
  });
  const staffPage = await marketerCtx.newPage();
  try {
    const workspace = new OrderWorkspacePage(staffPage);
    await workspace.gotoStaff(order.friendlyOrderId);

    const quote = new QuotationPage(staffPage);
    await quote.openTab();
    await quote.fillFirstLine("3D LED Channel Letters", "25000");
    await quote.sendToCustomer();

    await expectOrderStage(order.friendlyOrderId, "Quotation Sent");
    await expectQuotationStatus(order.orderUuid, "Sent");
  } finally {
    await marketerCtx.close();
  }

  // Customer reviews and approves on the portal.
  const { token } = await mintPortalToken({
    customerId: order.customerUuid,
    orderId: order.orderUuid,
  });
  const portalCtx = await browser.newContext({ baseURL });
  const portalPage = await portalCtx.newPage();
  try {
    const portal = new CustomerPortalPage(portalPage);
    await portal.gotoWithToken(token);
    await portal.approveQuotation();
    await expectQuotationStatus(order.orderUuid, "Approved");
    await expectOrderStage(order.friendlyOrderId, "Quotation Approved");
  } finally {
    await portalCtx.close();
  }
}

async function enableQuotationAutoApprovalInSettings(
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
      name: "Toggle auto-approval for Quotation",
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
      .poll(async () => (await getWorkflowAutoApproval()).quotation, {
        timeout: 15_000,
        message: "quotation auto-approval persisted",
      })
      .toBe(true);
  } finally {
    await adminCtx.close();
  }
}

test.describe("Quotation: Approval Layer (full workflow)", () => {
  test.describe("Staff request → admin approves", () => {
    test("customer-approved quote, staff request, admin Approve Stage → Design", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("quotation", false);

        const order = await bringOrderToQuotationInProgress(customer);
        await staffWriteAndSendQuote(browser, baseURL!, order);

        // Staff requests admin approval to leave Quotation Approved.
        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoStaff(order.friendlyOrderId);
          const quote = new QuotationPage(staffPage);
          await quote.openTab();
          await quote.staffRequestAdvance();

          await expectStageStatus(
            order.friendlyOrderId,
            "Pending Admin Approval: Design Stage"
          );
          await expectOrderStage(order.friendlyOrderId, "Quotation Approved");
        } finally {
          await marketerCtx.close();
        }

        // Admin reviews and approves from Admin Controls.
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

          await expectOrderStage(order.friendlyOrderId, "Design In Progress");
          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectTimelineEntry(
            order.friendlyOrderId,
            /approved stage progression|from "Quotation Approved"/i
          );
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("quotation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Staff request → admin rejects", () => {
    test("admin sends the quote back to staff for revision", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("quotation", false);

        const order = await bringOrderToQuotationInProgress(customer);
        await staffWriteAndSendQuote(browser, baseURL!, order);

        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoStaff(order.friendlyOrderId);
          const quote = new QuotationPage(staffPage);
          await quote.openTab();
          await quote.staffRequestAdvance();
          await expectStageStatus(
            order.friendlyOrderId,
            "Pending Admin Approval: Design Stage"
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
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);
          await expect(adminPage.getByText("Pending Approval")).toBeVisible({
            timeout: 10_000,
          });

          const adminWs = new OrderWorkspacePage(adminPage);
          await adminWs.openAdminControls();
          await adminWs.adminRequestChanges(
            "Please revise the letter rate — it is above the agreed budget."
          );

          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Quotation Approved");
          await expectTimelineEntry(order.friendlyOrderId, /requested changes/i);
        } finally {
          await adminCtx.close();
        }

        // Staff can request again after the reject.
        const marketerCtx2 = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage2 = await marketerCtx2.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage2);
          await workspace.gotoStaff(order.friendlyOrderId);
          const quote = new QuotationPage(staffPage2);
          await quote.openTab();
          await expect(
            staffPage2.getByRole("button", { name: /Request Advance to/i })
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await marketerCtx2.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("quotation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Auto-approval — toggle ON in Settings", () => {
    test("staff request auto-advances to Design; admin sees no pending", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("quotation", false);

        const order = await bringOrderToQuotationInProgress(customer);
        await staffWriteAndSendQuote(browser, baseURL!, order);

        await enableQuotationAutoApprovalInSettings(browser, baseURL!);

        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const workspace = new OrderWorkspacePage(staffPage);
          await workspace.gotoStaff(order.friendlyOrderId);
          const quote = new QuotationPage(staffPage);
          await quote.openTab();
          await quote.staffRequestAdvance();

          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Design In Progress");
          await expectTimelineEntry(order.friendlyOrderId, /Auto-approved/i);
        } finally {
          await marketerCtx.close();
        }

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
        await setWorkflowAutoApprovalStage("quotation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Admin writes the quotation and advances", () => {
    test("admin fills quote, sends it, then Approve without Customer → Design", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("quotation", false);

        const order = await bringOrderToQuotationInProgress(customer);

        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);

          const quote = new QuotationPage(adminPage);
          await quote.openTab();
          await quote.fillFirstLine("ACP Fascia with LED", "42000");
          await quote.sendToCustomer();

          await expectOrderStage(order.friendlyOrderId, "Quotation Sent");
          await expectQuotationStatus(order.orderUuid, "Sent");

          await quote.adminApproveWithoutCustomer();

          await expectQuotationStatus(order.orderUuid, "Approved");
          await expectOrderStage(order.friendlyOrderId, "Design In Progress");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("quotation", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });
});
