import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { createOrderAtSiteVisit } from "../helpers/create-order";
import { cleanupByEmail } from "../helpers/cleanup";
import {
  expectOrderStage,
  expectStageStatus,
  expectTimelineEntry,
} from "../helpers/assertions";
import { setWorkflowAutoApprovalStage } from "../helpers/settings";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { OrderWorkspacePage } from "../pages/OrderWorkspacePage";
import { SiteVisitPage } from "../pages/SiteVisitPage";

/**
 * End-to-end coverage of the Site Visit approval layer:
 *   pre-approval (staff completes work)
 *   → approval request (staff asks admin)
 *   → admin approves (Choose Workflow & Approve → Quote/Design First)
 *   → post-approval (stage advances to Quotation/Design In Progress)
 *
 * Also covers the admin "Request Changes" (reject) path and the
 * auto-approval flow (toggle ON → defaults to Quotation, no admin action).
 */
test.describe("Site Visit: Approval Layer (full workflow)", () => {
  test.describe("Manual approval staff request → admin approves", () => {
    test("admin approves with Quote First → Quotation In Progress", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        // Guarantee isolation: ensure auto-approval is OFF for the manual path.
        previousSetting = await setWorkflowAutoApprovalStage("site_visit", false);

        const order = await createOrderAtSiteVisit(customer);

        // ── Pre-approval: staff (marketer) completes the site visit work ──
        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const staff = new OrderWorkspacePage(staffPage);
          await staff.gotoStaff(order.friendlyOrderId);

          const siteVisit = new SiteVisitPage(staffPage);
          await siteVisit.openTab();
          await siteVisit.skipVisit(customer.location);
          await siteVisit.addItem();
          await siteVisit.fillActiveItemMeasurements("14", "7");

          // ── Approval request: staff asks admin ──
          await siteVisit.staffRequestAdminApproval();

          // Order parks in pending; stage unchanged.
          await expectStageStatus(
            order.friendlyOrderId,
            "Pending Admin Approval: Site Visit Completed"
          );
        } finally {
          await marketerCtx.close();
        }

        // ── Admin approves: choose Quote First ──
        const adminCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/admin.json",
        });
        const adminPage = await adminCtx.newPage();
        try {
          const admin = new AdminOrdersPage(adminPage);
          await admin.openOrder(order.friendlyOrderId);

          // Pending badge is visible on the order header.
          await expect(adminPage.getByText("Pending Approval")).toBeVisible({
            timeout: 10_000,
          });

          const adminWs = new OrderWorkspacePage(adminPage);
          await adminWs.openAdminControls();

          // Pending banner inside Admin Controls.
          await expect(adminPage.getByText("Pending Stage Approval")).toBeVisible({
            timeout: 10_000,
          });

          await adminWs.clickChooseWorkflowApprove();
          await adminWs.dismissCustomerMessageIfPresent();

          // Workflow choice modal appears.
          await expect(
            adminPage.getByRole("heading", { name: /Choose Workflow Path/i })
          ).toBeVisible({ timeout: 15_000 });

          await adminWs.selectQuoteFirstWorkflow();

          // ── Post-approval: stage advances to Quotation ──
          await expectOrderStage(order.friendlyOrderId, "Quotation In Progress");
          await expectStageStatus(order.friendlyOrderId, "Normal");
          // setWorkflowTypeAction logs "Workflow path set to ...".
          await expectTimelineEntry(
            order.friendlyOrderId,
            /Workflow path set|Order advanced to Quotation/i
          );
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("site_visit", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });

    test("admin approves with Design First → Design In Progress", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("site_visit", false);

        const order = await createOrderAtSiteVisit(customer);

        // Pre-approval: staff completes site visit + requests approval.
        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const staff = new OrderWorkspacePage(staffPage);
          await staff.gotoStaff(order.friendlyOrderId);

          const siteVisit = new SiteVisitPage(staffPage);
          await siteVisit.openTab();
          await siteVisit.skipVisit(customer.location);
          await siteVisit.addItem();
          await siteVisit.fillActiveItemMeasurements("18", "9");
          await siteVisit.staffRequestAdminApproval();

          await expectStageStatus(
            order.friendlyOrderId,
            "Pending Admin Approval: Site Visit Completed"
          );
        } finally {
          await marketerCtx.close();
        }

        // Admin approves with Design First.
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

          await adminWs.clickChooseWorkflowApprove();
          await adminWs.dismissCustomerMessageIfPresent();
          await adminWs.selectDesignFirstWorkflow();

          // Post-approval: stage advances to Design.
          await expectOrderStage(order.friendlyOrderId, "Design In Progress");
          await expectStageStatus(order.friendlyOrderId, "Normal");
        } finally {
          await adminCtx.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("site_visit", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Admin reject request changes back to staff", () => {
    test("admin sends the order back to staff for revision", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("site_visit", false);

        const order = await createOrderAtSiteVisit(customer);

        // Staff completes + requests approval.
        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const staff = new OrderWorkspacePage(staffPage);
          await staff.gotoStaff(order.friendlyOrderId);

          const siteVisit = new SiteVisitPage(staffPage);
          await siteVisit.openTab();
          await siteVisit.skipVisit(customer.location);
          await siteVisit.addItem();
          await siteVisit.fillActiveItemMeasurements("11", "4");
          await siteVisit.staffRequestAdminApproval();

          await expectStageStatus(
            order.friendlyOrderId,
            "Pending Admin Approval: Site Visit Completed"
          );
        } finally {
          await marketerCtx.close();
        }

        // Admin rejects with feedback.
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

          await adminWs.adminRequestChanges(
            "Please re-measure the storefront width; the value looks too small."
          );

          // Reject clears the pending status; stage stays at Site Visit.
          await expectStageStatus(order.friendlyOrderId, "Normal");
          // adminRejectStageAction logs "Admin requested changes at ...".
          await expectTimelineEntry(
            order.friendlyOrderId,
            /requested changes/i
          );
        } finally {
          await adminCtx.close();
        }

        // Staff can now edit again (the request-approval button reappears).
        const marketerCtx2 = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage2 = await marketerCtx2.newPage();
        try {
          const staff = new OrderWorkspacePage(staffPage2);
          await staff.gotoStaff(order.friendlyOrderId);

          const siteVisit = new SiteVisitPage(staffPage2);
          await siteVisit.openTab();
          // The request-approval button should be available again.
          await expect(
            staffPage2.getByRole("button", { name: /Request Admin Approval/i })
          ).toBeVisible({ timeout: 10_000 });
        } finally {
          await marketerCtx2.close();
        }
      } finally {
        await setWorkflowAutoApprovalStage("site_visit", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });

  test.describe("Auto-approval toggle ON skips admin", () => {
    test("staff request auto-advances to Quotation; admin sees no pending", async ({
      browser,
      baseURL,
    }) => {
      const customer = corporateCustomer();
      let previousSetting = false;
      try {
        previousSetting = await setWorkflowAutoApprovalStage("site_visit", true);

        const order = await createOrderAtSiteVisit(customer);

        // Staff completes + requests approval.
        const marketerCtx = await browser.newContext({
          baseURL,
          storageState: "e2e/.auth/marketer.json",
        });
        const staffPage = await marketerCtx.newPage();
        try {
          const staff = new OrderWorkspacePage(staffPage);
          await staff.gotoStaff(order.friendlyOrderId);

          const siteVisit = new SiteVisitPage(staffPage);
          await siteVisit.openTab();
          await siteVisit.skipVisit(customer.location);
          await siteVisit.addItem();
          await siteVisit.fillActiveItemMeasurements("13", "6");
          await siteVisit.staffRequestAdminApproval();

          // Auto-approval: advances directly to Quotation (default quote_first).
          await expectStageStatus(order.friendlyOrderId, "Normal");
          await expectOrderStage(order.friendlyOrderId, "Quotation In Progress");
          await expectTimelineEntry(order.friendlyOrderId, /Auto-approved/i);
        } finally {
          await marketerCtx.close();
        }

        // Admin opens the order no pending banner should appear.
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
        await setWorkflowAutoApprovalStage("site_visit", previousSetting);
        await cleanupByEmail(customer.email);
      }
    });
  });
});
