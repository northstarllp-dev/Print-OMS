import type { Page } from "@playwright/test";

export class ProductionPage {
  constructor(private readonly page: Page) {}

  async toggleChecklistItem(label: string | RegExp) {
    await this.page.getByText(label).first().click();
  }

  async completeAllChecklist() {
    for (const label of [
      "Procurement of Materials",
      "ACP & Acrylic Cutting",
      "Lighting & Wiring",
      "Quality Check",
    ]) {
      const item = this.page.getByText(label).first();
      if (await item.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await item.click();
      }
    }
  }
}
