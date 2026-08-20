import { expect, type Page } from "@playwright/test";

const DEFAULT_CHECKLIST = [
  "Site preparation completed",
  "Signage mounted securely",
  "Electricals/Wiring tested (if applicable)",
  "Site cleaned up",
] as const;

/**
 * Installation worksheet — locators match the live UI labels.
 */
export class InstallationPage {
  constructor(private readonly page: Page) {}

  async openTab() {
    await this.dismissCustomerMessageIfPresent();
    await this.page.getByRole("button", { name: "Installation", exact: true }).click();
    await this.chooseInstallationIfNeeded();
    await expect(
      this.page.getByRole("heading", { name: "Installation Schedule", exact: true })
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * PrintOMS shows a delivery-method chooser at Ready For Installation.
   * Existing schedule tests must pick "Schedule Installation" first.
   */
  async chooseInstallationIfNeeded() {
    const chooser = this.page.getByRole("heading", {
      name: /How will this order be delivered/i,
    });
    if (await chooser.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.page.getByRole("button", { name: /Schedule Installation/i }).click();
      await expect(chooser).toBeHidden({ timeout: 10_000 });
    }
  }

  async openDeliveryChooser() {
    await this.dismissCustomerMessageIfPresent();
    await this.page.getByRole("button", { name: "Installation", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: /How will this order be delivered/i })
    ).toBeVisible({ timeout: 15_000 });
  }

  async chooseCustomerPickup() {
    await this.openDeliveryChooser();
    await this.page.getByRole("button", { name: /Customer Pickup/i }).click();
    await expect(
      this.page.getByRole("heading", { name: /Customer Pickup \/ Self Receive/i })
    ).toBeVisible({ timeout: 20_000 });
  }

  async confirmCustomerCollected() {
    const confirm = this.page.getByRole("button", {
      name: /Confirm Pickup.*Customer Has Collected/i,
    });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await confirm.click();
    await expect(
      this.page.getByRole("heading", { name: /Pickup Confirmed/i })
    ).toBeVisible({ timeout: 20_000 });
    await this.dismissCustomerMessageIfPresent();
  }

  async dismissCustomerMessageIfPresent() {
    const heading = this.page.getByRole("heading", { name: /Customer Message/i });
    if (!(await heading.isVisible({ timeout: 4_000 }).catch(() => false))) {
      return;
    }
    await this.page.getByRole("button", { name: /^Close$/i }).click();
    await expect(heading).toBeHidden({ timeout: 10_000 });
  }

  /** Pick the first available date + 10:30 AM and confirm. */
  async confirmSchedule() {
    await this.openTab();

    const dateButtons = this.page
      .getByText("Select Date", { exact: true })
      .locator("..")
      .getByRole("button");
    await expect(dateButtons.first()).toBeVisible({ timeout: 10_000 });
    await dateButtons.first().click();

    const slot = this.page.getByRole("button", { name: "10:30 AM" });
    await expect(slot).toBeVisible({ timeout: 10_000 });
    await slot.click({ force: true });

    await this.page.getByRole("button", { name: "Confirm Schedule" }).click();
    await expect(
      this.page.getByText("Your installation has been scheduled")
    ).toBeVisible({ timeout: 20_000 });
    await this.dismissCustomerMessageIfPresent();
  }

  /**
   * Tick the field checklist when it rendered. Job-done does not require
   * ticks — an empty `installation.checklist` array leaves the heading with
   * no items, which is how the live worksheet behaves after scheduling.
   */
  async completeChecklist() {
    await expect(
      this.page.getByRole("heading", { name: "Installation Checklist", exact: true })
    ).toBeVisible({ timeout: 10_000 });

    const first = this.page.getByText("Site preparation completed").first();
    if (!(await first.isVisible({ timeout: 3_000 }).catch(() => false))) {
      return;
    }

    for (const label of DEFAULT_CHECKLIST) {
      await this.page.getByText(label).first().click();
    }
  }

  /**
   * Staff: submit job-done to admin. Native window.confirm, then the
   * worksheet stays on Installation Scheduled until admin closes payments.
   */
  async staffRequestJobDone() {
    this.page.once("dialog", (dialog) => dialog.accept());
    const request = this.page.getByRole("button", {
      name: /Request Admin Approval for Field Installation|Request Approval/i,
    });
    await expect(request).toBeVisible({ timeout: 15_000 });
    await expect(request).toBeEnabled({ timeout: 10_000 });
    await request.click();
  }

  /**
   * Admin: Review Payments & Complete modal — tick the confirmation
   * checkbox (records outstanding as received) then mark completed.
   */
  async confirmPaymentsAndComplete() {
    const heading = this.page.getByRole("heading", {
      name: /Review Payments & Complete Order/i,
    });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const confirmBox = this.page.getByRole("checkbox");
    await expect(confirmBox).toBeVisible({ timeout: 15_000 });
    await confirmBox.check();

    await expect(
      this.page.getByText(/Recording remaining payment/i)
    )
      .toBeHidden({ timeout: 20_000 })
      .catch(() => {});

    const complete = this.page.getByRole("button", {
      name: /Mark Order Completed/i,
    });
    await expect(complete).toBeEnabled({ timeout: 20_000 });
    await complete.click();
    await expect(heading).toBeHidden({ timeout: 20_000 });
  }

  /** Admin Payments tab: record the outstanding balance as received. */
  async recordOutstandingAsReceived() {
    await this.dismissCustomerMessageIfPresent();
    await this.page
      .getByRole("main")
      .getByRole("button", { name: "Payments", exact: true })
      .click();
    await expect(
      this.page.getByRole("heading", { name: /Payment Tracking/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText("Loading…")).toBeHidden({ timeout: 15_000 });
    await expect(this.page.getByRole("button", { name: "Add Payment" })).toBeVisible({
      timeout: 10_000,
    });

    await this.page.getByRole("button", { name: "Add Payment" }).click();
    const rest = this.page.getByRole("radio", { name: "Rest of amount" });
    await expect(rest).toBeVisible({ timeout: 10_000 });
    await rest.check();

    const save = this.page.getByRole("button", { name: "Payment Received" });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(this.page.getByText("Saving…")).toBeHidden({ timeout: 20_000 });
    await expect(this.page.getByText("Rest of Amount")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      this.page
        .locator("div")
        .filter({ hasText: /^Outstanding$/ })
        .locator("xpath=following-sibling::div[1]")
        .getByText("₹0")
    ).toBeVisible({ timeout: 15_000 });
  }
}
