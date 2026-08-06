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

    // Prefer search box when present
    const search = this.page.getByPlaceholder(/Search|search/i);
    const needle =
      opts.enquireId || opts.phone || opts.leadName || opts.businessName || "";
    if (needle && (await search.count()) && (await search.first().isVisible())) {
      await search.first().fill(needle);
      await this.page.waitForTimeout(400);
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

    const assign = this.page.getByRole("button", {
      name: /Save Assignments|Skip|Close|Done/i,
    });
    if (await assign.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await assign.first().click();
    }
  }
}
