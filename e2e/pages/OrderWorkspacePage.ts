import type { Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export class OrderWorkspacePage {
  constructor(private readonly page: Page) {}

  async gotoAdmin(orderId: string) {
    await this.page.goto(appPath(`/admin/orders/${orderId}`));
  }

  async gotoStaff(orderId: string) {
    await this.page.goto(appPath(`/staff/orders/${orderId}`));
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
