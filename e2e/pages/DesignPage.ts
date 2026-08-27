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
 * Staff/admin Design worksheet locators match the live UI labels.
 */
export class DesignPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.dismissCustomerMessageIfPresent(1_000);
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
    await this.dismissCustomerMessageIfPresent(8_000);
    await expect(this.page.getByText("Sent to Customer").first()).toBeVisible({
      timeout: 20_000,
    });
  }

  /** Admin WhatsApp/customer-message overlay after sending a proof. */
  async dismissCustomerMessageIfPresent(appearTimeoutMs = 3_000) {
    const title = this.page.locator("h2").filter({ hasText: /Customer Message/ });
    const visible = await title
      .waitFor({ state: "visible", timeout: appearTimeoutMs })
      .then(() => true)
      .catch(() => false);
    if (!visible) return;

    await this.page
      .getByText(/Generating secure customer link/i)
      .waitFor({ state: "hidden", timeout: 20_000 })
      .catch(() => {});
    await title.locator("xpath=../..").locator("button").filter({ hasText: "Close" }).click({
      force: true,
    });
    await expect(title).toBeHidden({ timeout: 10_000 });
  }

  /**
   * Designer: after the latest proof is Approved, upload a design source file,
   * hand off, then attach a production file for fabrication.
   */
  async uploadProductionFile(filePath = SAMPLE_PHOTO) {
    await this.dismissCustomerMessageIfPresent(1_000);

    const prodHeading = this.page.getByRole("heading", {
      name: /Final Production Files/i,
    });

    if (!(await prodHeading.isVisible().catch(() => false))) {
      await expect(
        this.page.getByRole("heading", { name: /Design Source Files/i })
      ).toBeVisible({ timeout: 15_000 });

      let uploadError = "";
      const onDialog = (dialog: { message: () => string; accept: () => Promise<void> }) => {
        uploadError = dialog.message();
        void dialog.accept();
      };
      this.page.on("dialog", onDialog);
      try {
        await this.page.getByTestId("design-source-file-input").setInputFiles(filePath);
        await expect(
          this.page.getByText("No design source files uploaded for this item yet.")
        ).toBeHidden({ timeout: 30_000 });
      } finally {
        this.page.off("dialog", onDialog);
      }
      if (uploadError) {
        throw new Error(`Design source upload failed: ${uploadError}`);
      }
      await expect(this.page.getByText(/sample-photo/i).last()).toBeVisible({
        timeout: 15_000,
      });

      const move = this.page.getByRole("button", {
        name: /Move to Production Files/i,
      });
      await expect(move).toBeEnabled({ timeout: 10_000 });
      await move.click();
      await expect(
        this.page.getByText(/handed off to production designer/i)
      ).toBeVisible({ timeout: 15_000 });
    }

    await expect(prodHeading).toBeVisible({ timeout: 15_000 });
    await this.page.getByTestId("production-file-input").setInputFiles(filePath);
    await expect(
      this.page.getByText("No production files uploaded for this item yet.")
    ).toBeHidden({ timeout: 30_000 });
    await expect(this.page.getByText(/sample-photo/i).last()).toBeVisible({
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
    const confirm = this.page.getByRole("button", {
      name: /Confirm & Request Admin Approval|Submit Request|Confirm/i,
    });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.first().click();
    }
  }

  /**
   * Admin: mark the design approved without waiting for the customer.
   * Does not start fabrication production files still need uploading.
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
