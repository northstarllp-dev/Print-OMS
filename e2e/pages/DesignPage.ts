import path from "node:path";
import { expect, type Page } from "@playwright/test";

const SAMPLE_PHOTO = path.resolve("e2e/data/sample-photo.png");

function localDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Staff/admin Design worksheet — locators match the live UI labels.
 */
export class DesignPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.dismissCustomerMessageIfPresent();
    await this.page.getByRole("button", { name: "Design", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: /Design Workflow/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Designer: attach the first proof, confirm the rotate preview, then wait
   * until V1 exists on the item.
   */
  async uploadFirstProof(filePath = SAMPLE_PHOTO) {
    const proofInput = this.page
      .locator("label")
      .filter({ hasText: /Upload First Proof/i })
      .locator('input[type="file"]');
    await expect(proofInput).toBeAttached({ timeout: 15_000 });
    await proofInput.setInputFiles(filePath);

    const preview = this.page.getByRole("heading", {
      name: /Preview & Rotate Image/i,
    });
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await this.page
      .getByRole("button", { name: /Confirm & Upload/i })
      .click();
    await expect(preview).toBeHidden({ timeout: 30_000 });
    await expect(
      this.page.getByRole("button", { name: /^V1$/ })
    ).toBeVisible({ timeout: 15_000 });
  }

  async sendToCustomer() {
    await this.page.getByRole("button", { name: /Send to Customer/i }).first().click();
    await this.dismissCustomerMessageIfPresent();
    await expect(this.page.getByText("Sent to Customer").first()).toBeVisible({
      timeout: 20_000,
    });
  }

  /** Admin WhatsApp/customer-message overlay after sending a proof. */
  async dismissCustomerMessageIfPresent() {
    const heading = this.page.getByRole("heading", { name: /Customer Message/i });
    if (!(await heading.isVisible({ timeout: 8_000 }).catch(() => false))) {
      return;
    }
    await this.page
      .getByText(/Generating secure customer link/i)
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => {});
    await this.page.getByRole("button", { name: /^Close$/i }).click();
    await expect(heading).toBeHidden({ timeout: 10_000 });
  }

  /**
   * Designer: after the latest version is Approved, attach a production file
   * for fabrication.
   */
  async uploadProductionFile(filePath = SAMPLE_PHOTO) {
    await expect(
      this.page.getByRole("heading", { name: /Final Production Files/i })
    ).toBeVisible({ timeout: 15_000 });

    const prodInput = this.page
      .locator("label")
      .filter({ hasText: /Upload File/i })
      .locator('input[type="file"]');
    await expect(prodInput).toBeAttached({ timeout: 10_000 });
    await prodInput.setInputFiles(filePath);

    await expect(
      this.page.getByText("No production files uploaded for this item yet.")
    ).toBeHidden({ timeout: 30_000 });
    await expect(this.page.getByText(/sample-photo/i).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Staff: request admin approval to leave Design Approved. */
  async staffRequestAdvance() {
    const request = this.page.getByRole("button", {
      name: /Request Admin Approval for Design Workflow|Request Approval/i,
    });
    await expect(request).toBeVisible({ timeout: 15_000 });
    await expect(request).toBeEnabled({ timeout: 10_000 });
    await request.click();
  }

  /**
   * Admin: mark the design approved without waiting for the customer.
   * Does not start fabrication — production files still need uploading.
   */
  async adminSkipCustomerApproval() {
    await this.dismissCustomerMessageIfPresent();
    this.page.once("dialog", (dialog) => dialog.accept());
    const skip = this.page.getByRole("button", {
      name: /Approve design \(skip customer\)|Approve design/i,
    });
    await expect(skip).toBeVisible({ timeout: 15_000 });
    await skip.click({ force: true });
    await expect(skip).toBeHidden({ timeout: 20_000 });
  }

  /** Admin: after proofs + approval + production files, start fabrication. */
  async adminStartFabrication(deadlineYyyyMmDd = localDatePlusDays(14)) {
    await this.dismissCustomerMessageIfPresent();
    const start = this.page.getByRole("button", {
      name: /Set deadline & start fabrication|Start fabrication/i,
    });
    await expect(start).toBeVisible({ timeout: 15_000 });
    await start.click({ force: true });

    const heading = this.page.getByRole("heading", {
      name: /Before fabrication starts/i,
    });
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await this.page
      .locator("#production-advance-install-deadline")
      .fill(deadlineYyyyMmDd);
    await this.page
      .getByRole("button", { name: /Confirm & start fabrication/i })
      .click();
    await expect(heading).toBeHidden({ timeout: 20_000 });
  }
}

export { localDatePlusDays, SAMPLE_PHOTO };
