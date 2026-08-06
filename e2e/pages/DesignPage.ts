import type { Page } from "@playwright/test";

export class DesignPage {
  constructor(private readonly page: Page) {}

  async uploadProof() {
    await this.page
      .getByRole("button", {
        name: /Upload First Proof|Upload New Design Proof/i,
      })
      .first()
      .click();
  }

  async sendToCustomer() {
    await this.page.getByRole("button", { name: /Send to Customer/i }).click();
  }
}
