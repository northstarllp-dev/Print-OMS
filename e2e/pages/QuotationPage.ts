import { expect, type Page } from "@playwright/test";

/**
 * Staff/admin Quote worksheet — locators match the live UI labels.
 */
export class QuotationPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.dismissCustomerMessageIfPresent();
    await this.page.getByRole("button", { name: "Quote", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: /Product Quote/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Fill the first empty line (created from the site-visit item) with a
   * description and unit rate. Qty/measurement is already seeded from the visit.
   */
  async fillFirstLine(description: string, unitPrice: string) {
    const desc = this.page.getByPlaceholder(/Search product or type description/i).first();
    await expect(desc).toBeVisible({ timeout: 10_000 });
    await desc.fill(description);

    const rate = this.page.getByPlaceholder("0.00").first();
    await rate.fill(unitPrice);
  }

  async saveDraft() {
    await this.page.getByRole("button", { name: /Save Draft/i }).click();
    await expect(this.page.getByText(/Quotation saved/i)).toBeVisible({
      timeout: 15_000,
    });
  }

  async sendToCustomer() {
    await this.page.getByRole("button", { name: /Send to Customer/i }).first().click();
    await expect(
      this.page.getByRole("heading", { name: /Confirm Quotation/i })
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole("button", { name: /^Send to Customer$/i }).last().click();
    await expect(
      this.page.getByRole("heading", { name: /Confirm Quotation/i })
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      this.page.getByRole("heading", { name: /Customer Message/i })
    ).toBeVisible({ timeout: 20_000 });
    await this.dismissCustomerMessageIfPresent();
  }

  /** WhatsApp/customer-message overlay after sending a quote (staff and admin). */
  async dismissCustomerMessageIfPresent() {
    const heading = this.page.getByRole("heading", { name: /Customer Message/i });
    if (!(await heading.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return;
    }
    await this.page
      .getByText(/Generating secure customer link/i)
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => {});
    await this.page.getByRole("button", { name: /^Close$/i }).click();
    await expect(heading).toBeHidden({ timeout: 10_000 });
  }

  /** Staff: request admin approval to leave Quotation Approved. */
  async staffRequestAdvance() {
    const request = this.page.getByRole("button", {
      name: /Request Advance to/i,
    });
    await expect(request).toBeVisible({ timeout: 15_000 });
    await request.click();
    await expect(
      this.page.getByRole("heading", { name: /Request Advance to/i })
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole("button", { name: /Submit Request/i }).click();
  }

  /** Admin: mark the quote approved without waiting for the customer, then advance. */
  async adminApproveWithoutCustomer() {
    await this.dismissCustomerMessageIfPresent();
    await expect(
      this.page.getByRole("heading", { name: /Customer Message/i })
    ).toBeHidden({ timeout: 5_000 });

    const override = this.page.getByRole("button", {
      name: /Approve without Customer/i,
    });
    await expect(override).toBeVisible({ timeout: 15_000 });
    await expect(override).toBeEnabled();
    await override.click();
    await expect(
      this.page.getByRole("heading", { name: /Approve Without Customer/i })
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole("button", { name: /^Approve & Advance$/i }).click();
    await expect(
      this.page.getByRole("heading", { name: /Approve Without Customer/i })
    ).toBeHidden({ timeout: 20_000 });
  }

  /** Admin: after customer (or override) approval, move to the next pipeline stage. */
  async adminMoveToNextStage() {
    const move = this.page.getByRole("button", { name: /Move to /i });
    await expect(move).toBeVisible({ timeout: 15_000 });
    await move.click();
    await expect(
      this.page.getByRole("heading", { name: /Move to /i })
    ).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole("button", { name: /Move to /i }).last().click();
  }
}
