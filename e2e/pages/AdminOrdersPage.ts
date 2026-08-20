import type { Page } from "@playwright/test";
import { appPath } from "../helpers/paths";

export class AdminOrdersPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(appPath("/admin/orders"));
  }

  async gotoEnquire() {
    await this.page.goto(appPath("/admin/enquire"));
  }

  async openOrder(friendlyOrUuid: string) {
    await this.page.goto(appPath(`/admin/orders/${friendlyOrUuid}`));
  }

  /** Create a lead via Admin → Enquire → New Enquiry modal. */
  async createEnquiry(opts: {
    businessName: string;
    leadName: string;
    phone: string;
    email: string;
    location?: string;
    notes?: string;
  }) {
    await this.gotoEnquire();
    await this.page.getByRole("button", { name: /New Enquiry/i }).click();
    await this.page.getByRole("heading", { name: /New Lead Enquiry/i }).waitFor();

    await this.page.locator('input[name="businessName"]').fill(opts.businessName);
    await this.page.locator('input[name="leadName"]').fill(opts.leadName);
    await this.page.locator('input[name="phone"]').fill(opts.phone);
    await this.page.locator('input[name="email"]').fill(opts.email);

    if (opts.location) {
      await this.page.locator('input[name="location"]').fill(opts.location);
    }
    if (opts.notes) {
      await this.page.locator('textarea[name="notes"]').fill(opts.notes);
    }

    await this.page.getByRole("button", { name: /Create Enquiry/i }).click();
    await this.page
      .getByText(/Enquiry Created Successfully/i)
      .waitFor({ timeout: 20_000 });

    // Dismiss success modal if present
    const ok = this.page.getByRole("button", { name: /^Okay$/i });
    if (await ok.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await ok.first().click();
    }
  }

  async convertEnquiryToOrder(opts: {
    leadName: string;
    businessName?: string;
    enquireId?: string | null;
    phone?: string;
  }) {
    await this.gotoEnquire();

    // Clear date-range filter if visible so brand-new enquiries always appear
    const allDates = this.page.getByRole("button", {
      name: /All Dates|All Time|Clear|Reset/i,
    });
    if (await allDates.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await allDates.first().click();
    }

    const search = this.page
      .getByPlaceholder(/Search enquiries/i)
      .locator("visible=true")
      .first();
    const needle =
      opts.enquireId || opts.phone || opts.leadName || opts.businessName || "";
    if (needle && (await search.isVisible({ timeout: 5_000 }).catch(() => false))) {
      await search.fill(needle);
      await this.page.waitForTimeout(500);
    }

    const row = this.page
      .getByText(needle, { exact: false })
      .locator("visible=true")
      .first();
    await row.waitFor({ state: "visible", timeout: 20_000 });

    // Prefer the visible Convert button (desktop table / mobile card)
    const convertBtn = this.page
      .getByRole("button", { name: /Convert to Order/i })
      .locator("visible=true")
      .first();
    await convertBtn.click();
    await this.page.getByRole("heading", { name: "Convert to Order" }).waitFor({
      timeout: 15_000,
    });

    const businessInput = this.page.locator(
      'input[name="businessName"], input[placeholder*="Business"]'
    );
    if (
      opts.businessName &&
      (await businessInput.count()) &&
      (await businessInput.first().isVisible())
    ) {
      await businessInput.first().fill(opts.businessName);
    }

    await this.page.getByRole("button", { name: /Create Order/i }).click();

    // Convert is a server action — wait for the success popup before navigating
    // away, otherwise the request is aborted and the enquiry stays Pending.
    const customerMsg = this.page.getByRole("heading", {
      name: /Customer Message/i,
    });
    await customerMsg.waitFor({ state: "visible", timeout: 30_000 });
    await this.page
      .getByRole("button", { name: /Assign Employees|^Close$/i })
      .locator("visible=true")
      .first()
      .click();
    await customerMsg.waitFor({ state: "hidden", timeout: 15_000 });

    const assignHeading = this.page.getByRole("heading", {
      name: "Assign Employees",
      exact: true,
    });
    if (await assignHeading.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await assignHeading.locator("xpath=../..").getByRole("button").click();
    }

    const okay = this.page.getByRole("button", { name: /^Okay$/i });
    if (await okay.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await okay.first().click();
    }
  }

  async searchEnquiries(term: string) {
    await this.gotoEnquire();
    const reset = this.page.getByRole("button", { name: /Reset/i }).locator("visible=true");
    if (await reset.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reset.first().click();
    }
    const search = this.page
      .getByPlaceholder(/Search enquiries/i)
      .locator("visible=true")
      .first();
    await search.waitFor({ state: "visible", timeout: 15_000 });
    await search.fill(term);
    await this.page.waitForTimeout(500);
  }

  async editVisibleEnquiry(leadName: string) {
    await this.page
      .getByRole("button", { name: /Edit/i })
      .locator("visible=true")
      .first()
      .click();
    await this.page.getByRole("heading", { name: /Edit Enquiry/i }).waitFor();
    await this.page.locator('input[name="leadName"]').fill(leadName);
    await this.page.getByRole("button", { name: /Save Changes/i }).click();
    await this.page.getByRole("heading", { name: /Edit Enquiry/i }).waitFor({
      state: "hidden",
      timeout: 15_000,
    });
  }

  async deleteVisibleEnquiry() {
    await this.page
      .getByRole("button", { name: /Delete/i })
      .locator("visible=true")
      .first()
      .click();
    await this.page.getByRole("heading", { name: /Delete Enquiry/i }).waitFor();
    await this.page.getByRole("button", { name: /^Delete$/i }).last().click();
    await this.page.getByRole("heading", { name: /Delete Enquiry/i }).waitFor({
      state: "hidden",
      timeout: 15_000,
    });
  }
}
