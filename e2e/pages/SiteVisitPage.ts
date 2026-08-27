import { expect, type Page } from "@playwright/test";

/**
 * Staff/admin Site Visit worksheet locators match the live UI labels.
 */
export class SiteVisitPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.page.getByRole("button", { name: "Site Visit", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: /Site Visit Audit/i })
    ).toBeVisible();
  }

  /** Skip the physical visit and keep the installation pin from the map modal. */
  async skipVisit(fallbackAddress = "Indiranagar, Bengaluru") {
    await this.page.getByRole("button", { name: "Skip Visit & Add Values" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Installation Location" })
    ).toBeVisible();

    const address = this.page.getByPlaceholder(/Search address|Full address/i).first();
    await expect(address).toBeVisible();
    if (!(await address.inputValue()).trim()) {
      await address.fill(fallbackAddress);
    }

    await this.page.getByRole("button", { name: "Save Location & Skip Visit" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Installation Location" })
    ).toBeHidden({ timeout: 15_000 });
    await expect(this.page.getByText("Site Visit Skipped")).toBeVisible({
      timeout: 15_000,
    });
  }

  async scheduleVisit(siteAddress: string) {
    await this.page.getByRole("button", { name: "Schedule by yourself" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Schedule Site Visit" })
    ).toBeVisible();

    await this.page.locator("button", { hasText: /Mon|Tue|Wed|Thu|Fri|Sat/ }).first().click();
    await this.page.getByRole("button", { name: "10 AM - 11 AM" }).click();

    const address = this.page.getByPlaceholder(/Search address|Full address/i).first();
    await address.fill(siteAddress);
    await this.page.getByRole("button", { name: "Schedule Visit" }).click();

    await expect(
      this.page.getByRole("heading", { name: "Scheduled Site Visit" })
    ).toBeVisible({ timeout: 15_000 });

    const customerMsg = this.page.getByRole("heading", {
      name: /Customer Message/i,
    });
    if (await customerMsg.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await this.page.getByRole("button", { name: /^Close/i }).click();
      await expect(customerMsg).toBeHidden({ timeout: 10_000 });
    }
  }

  async addItem(label?: RegExp | string) {
    await this.page.getByRole("button", { name: "New Item" }).click();
    await expect(
      this.page.getByRole("button", { name: label ?? /^Item-1$/ })
    ).toBeVisible();
  }

  async fillActiveItemMeasurements(width: string, height: string, notes?: string) {
    const widthInput = this.page.getByPlaceholder("0.00").first();
    if (!(await widthInput.isVisible())) {
      await this.page.getByRole("button", { name: /Measurement Details/i }).click();
    }

    await this.page.getByPlaceholder("0.00").first().fill(width);
    await this.page.getByPlaceholder("0.00").nth(1).fill(height);

    if (notes) {
      await this.page
        .getByPlaceholder(/Details on wall conditions, accessibility barriers/i)
        .fill(notes);
    }
  }

  async setScaffoldingRequired() {
    const section = this.page.getByRole("button", {
      name: /Installation Requirements/i,
    });
    await section.click();
    await this.page.getByText("Scaffolding Required", { exact: true }).click();
  }

  async saveDraft() {
    await this.page.getByRole("button", { name: /Save Draft/i }).first().click();
    await expect(this.page.getByText(/Draft saved successfully/i)).toBeVisible({
      timeout: 15_000,
    });
  }

  async removeLastItem() {
    await this.page.getByTitle("Remove item").last().click();
  }

  /**
   * Admin: Approve & Advance → lock review → Quote First / Design First.
   */
  async adminLockAndChooseWorkflow(path: "quote_first" | "design_first") {
    const approve = this.page.getByRole("button", { name: /Approve & Advance/i });
    await expect(approve).toBeVisible({ timeout: 15_000 });
    await approve.click();

    await expect(
      this.page.getByRole("heading", { name: /Review & Confirm Site Visit/i })
    ).toBeVisible();
    await this.page
      .getByRole("button", { name: /Confirm & Lock Site Visit/i })
      .click();

    const customerMsg = this.page.getByRole("heading", {
      name: /Customer Message/i,
    });
    if (await customerMsg.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await this.page.getByRole("button", { name: /^Close/i }).click();
    }

    await expect(
      this.page.getByRole("heading", { name: /Choose Workflow Path/i })
    ).toBeVisible({ timeout: 15_000 });

    await this.page
      .getByRole("button", {
        name:
          path === "quote_first" ? /Select Quote First/i : /Select Design First/i,
      })
      .click();
  }

  /** Staff: request admin approval (does not lock; admin chooses workflow later). */
  async staffRequestAdminApproval() {
    const request = this.page.getByRole("button", {
      name: /Request Admin Approval/i,
    });
    await expect(request).toBeVisible({ timeout: 15_000 });
    await request.click();

    await expect(
      this.page.getByRole("heading", { name: /Confirm Site Visit Summary/i })
    ).toBeVisible();
    await this.page
      .getByRole("button", { name: /Confirm & Request Admin Approval/i })
      .click();
  }
}
