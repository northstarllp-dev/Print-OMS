import type { Browser } from "@playwright/test";
import type { CustomerFixture } from "../fixtures/customers";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { LoginPage } from "../pages/LoginPage";
import { seedUsers } from "../fixtures/users";
import {
  expectCustomerExists,
  expectEnquiryExists,
  expectOrderStage,
  getEnquiryByEmail,
  getOrderByCustomerEmail,
} from "./assertions";

export type CreatedOrder = {
  orderUuid: string;
  friendlyOrderId: string;
  customerUuid: string;
  enquiryId: string | null;
  enquireId: string | null;
};

/**
 * Admin creates enquiry → converts to order.
 * Uses a fresh admin UI login (more reliable than storageState for SSR cookies).
 */
export async function createOrderViaEnquiry(
  browser: Browser,
  customer: CustomerFixture
): Promise<CreatedOrder> {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  try {
    const login = new LoginPage(adminPage, "admin");
    await login.goto();
    await login.signIn(seedUsers.admin.email, seedUsers.admin.password);

    const admin = new AdminOrdersPage(adminPage);
    await admin.createEnquiry({
      businessName: customer.businessName,
      leadName: customer.name,
      phone: customer.phone,
      email: customer.email,
      location: customer.location,
      notes: `${customer.productType} — E2E enquiry`,
    });

    await expectEnquiryExists({ email: customer.email, status: "Pending" });
    await expectCustomerExists({ email: customer.email });

    const enquiry = await getEnquiryByEmail(customer.email);

    await admin.convertEnquiryToOrder({
      leadName: customer.name,
      businessName: customer.businessName,
      enquireId: enquiry?.enquire_id,
      phone: customer.phone,
    });

    const order = await waitForOrder(customer.email);
    await expectOrderStage(order.order_id, "Site Visit Pending");

    return {
      orderUuid: order.id,
      friendlyOrderId: order.order_id,
      customerUuid: order.customer_id,
      enquiryId: enquiry?.id ?? null,
      enquireId: enquiry?.enquire_id ?? null,
    };
  } finally {
    await adminCtx.close();
  }
}

async function waitForOrder(email: string, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const order = await getOrderByCustomerEmail(email);
    if (order) return order;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for order for ${email}`);
}
