import type { Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export class CustomerPortalPage {
  constructor(private readonly page: Page) {}

  async gotoWithToken(token: string) {
    await this.page.goto(appPath(`/portal?token=${token}`));
  }

  async openOrder(orderFriendlyId: string) {
    await this.page.getByText(orderFriendlyId, { exact: false }).first().click();
  }

  async approveQuotation() {
    await this.page
      .getByRole("button", { name: /Approve Quotation/i })
      .click();
    const confirm = this.page.getByRole("button", {
      name: /Confirm|Approve/i,
    });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.first().click();
    }
  }

  async approveDesign() {
    await this.page.getByRole("button", { name: /Approve Design/i }).click();
    const confirm = this.page.getByRole("button", {
      name: /Confirm Approval|Confirm/i,
    });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.first().click();
    }
  }

  async expectVisibleText(text: string | RegExp) {
    await this.page.getByText(text).first().waitFor({ timeout: 20_000 });
  }
}
