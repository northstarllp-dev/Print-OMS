import type { Page } from "@playwright/test";

export class InstallationPage {
  constructor(private readonly page: Page) {}

  async confirmSchedule() {
    await this.page.getByRole("button", { name: /Confirm Schedule/i }).click();
  }

  async markCompleted() {
    await this.page
      .getByRole("button", { name: /Mark Order Completed/i })
      .click();
  }
}
