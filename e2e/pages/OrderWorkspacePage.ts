import { expect, type Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export class OrderWorkspacePage {
  constructor(private readonly page: Page) {}

  async gotoAdmin(orderId: string) {
    await this.page.goto(appPath(`/admin/orders/${orderId}`));
  }

  async gotoStaff(orderId: string) {
    const url = appPath(`/staff/orders/${orderId}`);
    await this.page.goto(url);
    // Next can serve a compile-time 404 on the first hit of a new route.
    const notFound = this.page.getByText("This page could not be found.");
    if (await notFound.isVisible().catch(() => false)) {
      await this.page.waitForTimeout(2_000);
      await this.page.goto(url);
    }
  }

  async gotoProduction(orderId: string) {
    await this.page.goto(appPath(`/production/orders/${orderId}`));
  }

  async gotoInstallation(orderId: string) {
    await this.page.goto(appPath(`/installation/orders/${orderId}`));
  }

  async openStageTab(label: string | RegExp) {
    await this.page.getByRole("button", { name: label }).first().click();
  }

  async requestAdminApproval(moduleHint?: string | RegExp) {
    const name =
      moduleHint ??
      /Request Admin Approval|Request Advance|Request Approval/i;
    await this.page.getByRole("button", { name }).first().click();

    const confirm = this.page.getByRole("button", {
      name: /Confirm & Request Admin Approval|Submit Request|Confirm/i,
    });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.first().click();
    }
  }

  async approveAndAdvance() {
    const btn = this.page.getByRole("button", {
      name: /Approve & Advance|Approve Stage|Choose Workflow & Approve/i,
    });
    await btn.first().click();
  }

  /** Admin: open the Admin Controls tab on a pending order. */
  async openAdminControls() {
    await this.page
      .getByRole("button", { name: /Admin Controls/i })
      .first()
      .click();
  }

  /** Admin: click "Choose Workflow & Approve" (site-visit pending path). */
  async clickChooseWorkflowApprove() {
    await this.page
      .getByRole("button", { name: /Choose Workflow & Approve/i })
      .first()
      .click();
  }

  /** Admin: click "Approve Stage" (quotation / production pending). */
  async clickApproveStage() {
    await this.page
      .getByRole("button", { name: /Approve Stage/i })
      .first()
      .click();
  }

  /** Admin: Job Done pending open the payments-and-complete modal. */
  async clickReviewPaymentsAndComplete() {
    await this.page
      .getByRole("button", { name: /Review Payments & Complete/i })
      .first()
      .click();
  }

  /**
   * Admin: from Admin Controls or the Design tab, open the fabrication-deadline
   * modal (label is "Set deadline & start fabrication" once Design is approved).
   */
  async clickStartFabrication() {
    await this.page
      .getByRole("button", {
        name: /Set deadline & start fabrication|Start fabrication/i,
      })
      .first()
      .click();
  }

  /** Fill the ProductionAdvanceModal date and confirm. */
  async confirmStartFabrication(deadlineYyyyMmDd: string) {
    const heading = this.page.getByRole("heading", {
      name: /Before fabrication starts/i,
    });
    await heading.waitFor({ state: "visible", timeout: 15_000 });
    await this.page
      .locator("#production-advance-install-deadline")
      .fill(deadlineYyyyMmDd);
    await this.page
      .getByRole("button", { name: /Confirm & start fabrication/i })
      .click();
    await heading.waitFor({ state: "hidden", timeout: 20_000 });
  }

  /** Dismiss the "Customer Message" modal if it appears (staff and admin). */
  async dismissCustomerMessageIfPresent() {
    const customerMsg = this.page.getByRole("heading", {
      name: /Customer Message/i,
    });
    if (await customerMsg.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await this.page.getByRole("button", { name: /^Close/i }).first().click();
      await customerMsg.waitFor({ state: "hidden", timeout: 10_000 });
    }
  }

  /**
   * Bottom-right WhatsApp catch-up FAB. Hidden while a message overlay is open.
   */
  async openCustomerMessageFab() {
    await this.dismissCustomerMessageIfPresent();
    const fab = this.page.getByRole("button", {
      name: "Send customer WhatsApp message",
    });
    await expect(fab).toBeVisible({ timeout: 15_000 });
    await fab.click();
    await expect(
      this.page.getByRole("heading", { name: "Send customer message", exact: true })
    ).toBeVisible({ timeout: 10_000 });
  }

  async pickCustomerMessageTemplate(title: string | RegExp) {
    await this.page.getByRole("button", { name: title }).first().click();
    await expect(
      this.page.getByRole("heading", { name: /Customer Message/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Admin: reject / request changes with mandatory feedback notes. */
  async adminRequestChanges(notes: string) {
    await this.page
      .getByRole("button", { name: /Request Changes/i })
      .first()
      .click();
    const textarea = this.page.getByPlaceholder(/Describe what needs to be revised/i);
    await textarea.fill(notes);
    await this.page
      .getByRole("button", { name: /Send Back to Staff/i })
      .click();
  }

  async selectQuoteFirstWorkflow() {
    await this.page
      .getByRole("button", { name: /Select Quote First/i })
      .click();
  }

  async selectDesignFirstWorkflow() {
    await this.page
      .getByRole("button", { name: /Select Design First/i })
      .click();
  }
}
