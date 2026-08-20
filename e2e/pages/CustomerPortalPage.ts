import { expect, type Page } from "@playwright/test";
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
    const approve = this.page.getByRole("button", {
      name: "Approve Quotation",
      exact: true,
    });
    await approve.waitFor({ state: "visible", timeout: 20_000 });
    await approve.click();
    await expect(approve).toBeHidden({ timeout: 20_000 });
  }

  async openDesignStep() {
    const approve = this.page.getByRole("button", {
      name: "Approve Design",
      exact: true,
    });
    if (await approve.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }
    await this.page.getByText("Design", { exact: true }).first().click();
  }

  async approveDesign() {
    await this.openDesignStep();
    const approve = this.page.getByRole("button", {
      name: "Approve Design",
      exact: true,
    });
    await approve.waitFor({ state: "visible", timeout: 20_000 });
    await approve.click();

    await expect(
      this.page.getByRole("heading", { name: /Confirm Design Approval/i })
    ).toBeVisible({ timeout: 10_000 });
    await this.page
      .getByRole("button", { name: /Confirm Approval|Confirm/i })
      .last()
      .click();
    await expect(approve).toBeHidden({ timeout: 20_000 });
  }

  async expectVisibleText(text: string | RegExp) {
    await this.page.getByText(text).first().waitFor({ timeout: 20_000 });
  }
}
