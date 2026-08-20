import { test, expect } from "@playwright/test";
import { corporateCustomer } from "../fixtures/customers";
import { cleanupByEmail } from "../helpers/cleanup";
import { expectEnquiryExists } from "../helpers/assertions";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";

test.describe("Enquiries: edit and delete", () => {
  test("admin can edit a pending enquiry then delete it", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    const ctx = await browser.newContext({
      baseURL,
      storageState: "e2e/.auth/admin.json",
    });
    const page = await ctx.newPage();
    try {
      const admin = new AdminOrdersPage(page);
      await admin.createEnquiry({
        businessName: customer.businessName,
        leadName: customer.name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
        notes: "E2E edit/delete enquiry",
      });

      await admin.searchEnquiries(customer.email);
      await expect(
        page.getByText(customer.businessName).locator("visible=true").first()
      ).toBeVisible({ timeout: 15_000 });

      const updatedName = `${customer.name} (edited)`;
      await admin.editVisibleEnquiry(updatedName);
      await admin.searchEnquiries(customer.email);
      await expect(
        page.getByText(updatedName).locator("visible=true").first()
      ).toBeVisible({ timeout: 15_000 });

      await admin.deleteVisibleEnquiry();
      await admin.searchEnquiries(customer.email);
      await expect(
        page.getByText(customer.businessName).locator("visible=true")
      ).toHaveCount(0);
    } finally {
      await ctx.close();
      await cleanupByEmail(customer.email);
    }
  });

  test("converted enquiry does not show edit or delete", async ({
    browser,
    baseURL,
  }) => {
    const customer = corporateCustomer();
    const ctx = await browser.newContext({
      baseURL,
      storageState: "e2e/.auth/admin.json",
    });
    const page = await ctx.newPage();
    try {
      const admin = new AdminOrdersPage(page);
      await admin.createEnquiry({
        businessName: customer.businessName,
        leadName: customer.name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
      });
      await admin.convertEnquiryToOrder({
        leadName: customer.name,
        businessName: customer.businessName,
        phone: customer.phone,
      });
      await expectEnquiryExists({ email: customer.email, status: "Converted" });

      await admin.searchEnquiries(customer.email);
      await expect(
        page.getByText(customer.businessName).locator("visible=true").first()
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("button", { name: /Edit/i }).locator("visible=true")
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Delete/i }).locator("visible=true")
      ).toHaveCount(0);
    } finally {
      await ctx.close();
      await cleanupByEmail(customer.email);
    }
  });
});
