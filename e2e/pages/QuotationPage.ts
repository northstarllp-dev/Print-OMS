import type { Page } from "@playwright/test";

export class QuotationPage {
  constructor(private readonly page: Page) {}

  async saveDraft() {
    await this.page.getByRole("button", { name: /Save Draft/i }).click();
  }

  async sendToCustomer() {
    await this.page.getByRole("button", { name: /Send to Customer/i }).first().click();
    const confirm = this.page.getByRole("button", {
      name: /^Send to Customer$/i,
    });
    if (await confirm.nth(1).isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirm.nth(1).click();
    }
  }
}
