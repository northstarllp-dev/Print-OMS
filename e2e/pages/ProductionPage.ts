import { expect, type Page } from "@playwright/test";

const DEFAULT_CHECKLIST = [
  "Procurement of Materials",
  "ACP & Acrylic Cutting",
  "Lighting & Wiring",
  "Quality Check",
] as const;

/**
 * Production / fabrication worksheet — locators match the live UI labels.
 */
export class ProductionPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.dismissCustomerMessageIfPresent();
    await this.page.getByRole("button", { name: "Production", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: "Workshop Production", exact: true })
    ).toBeVisible({ timeout: 15_000 });
  }

  async dismissCustomerMessageIfPresent() {
    const heading = this.page.getByRole("heading", { name: /Customer Message/i });
    if (!(await heading.isVisible({ timeout: 4_000 }).catch(() => false))) {
      return;
    }
    await this.page.getByRole("button", { name: /^Close$/i }).click();
    await expect(heading).toBeHidden({ timeout: 10_000 });
  }

  async toggleChecklistItem(label: string | RegExp) {
    await this.page.getByText(label).first().click();
    await this.waitForChecklistSave();
  }

  async addExtraCheck(label: string) {
    const input = this.page.getByPlaceholder(/e\.g\. Touch up paint/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(label);
    await this.page.getByRole("button", { name: /^Add$/i }).click();
    await expect(this.page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
    await this.waitForChecklistSave();
  }

  async completeAllChecklist() {
    for (const label of DEFAULT_CHECKLIST) {
      const item = this.page.getByText(label).first();
      await expect(item).toBeVisible({ timeout: 10_000 });
      await item.click();
      await this.waitForChecklistSave();
    }
  }

  /** Staff: request admin approval to leave Production. */
  async staffRequestAdvance() {
    const request = this.page.getByRole("button", {
      name: /Request Admin Approval for Fabrication Checklist|Request Approval/i,
    });
    await expect(request).toBeVisible({ timeout: 15_000 });
    await expect(request).toBeEnabled({ timeout: 10_000 });
    await request.click();
  }

  /** Admin: after the checklist is complete, advance without a staff request. */
  async adminApproveAndAdvance() {
    await this.dismissCustomerMessageIfPresent();
    const approve = this.page.getByRole("button", {
      name: /Approve & Advance/i,
    });
    await expect(approve).toBeVisible({ timeout: 15_000 });
    await expect(approve).toBeEnabled();
    await approve.click();
    await this.dismissCustomerMessageIfPresent();
  }

  private async waitForChecklistSave() {
    const saving = this.page.getByText("Updating database...");
    if (await saving.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(saving).toBeHidden({ timeout: 15_000 });
    }
  }
}
