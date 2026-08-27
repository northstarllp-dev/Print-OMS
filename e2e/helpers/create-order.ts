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
import { createOrderDirect } from "./stages";

export type CreatedOrder = {
  orderUuid: string;
  friendlyOrderId: string;
  customerUuid: string;
  enquiryId: string | null;
  enquireId: string | null;
};

/** Map a DB-seeded order row onto the shape the worksheet specs use. */
export function fromSeed(row: {
  id: string;
  order_id: string;
  customerUuid: string;
}): CreatedOrder {
  return {
    orderUuid: row.id,
    friendlyOrderId: row.order_id,
    customerUuid: row.customerUuid,
    enquiryId: null,
    enquireId: null,
  };
}

/**
 * Fast path: insert customer + order at Site Visit Pending (no enquiry UI).
 * Use this for stage worksheet tests. Keep createOrderViaEnquiry for the
 * enquiry → convert happy path only.
 */
export async function createOrderAtSiteVisit(
  customer: CustomerFixture
): Promise<CreatedOrder> {
  return fromSeed(await createOrderDirect(customer));
}

/**
 * Admin creates enquiry → converts to order (slow: real login + two modals).
 * Reserve for e2e/flows and e2e/enquiries.
 */
export async function createOrderViaEnquiry(
  browser: Browser,
  baseURLOrCustomer: string | CustomerFixture | undefined,
  maybeCustomer?: CustomerFixture
): Promise<CreatedOrder> {
  const customer =
    typeof baseURLOrCustomer === "string" || baseURLOrCustomer === undefined
      ? maybeCustomer
      : baseURLOrCustomer;
  if (!customer) {
    throw new Error("createOrderViaEnquiry: customer fixture is required");
  }
  const baseURL =
    typeof baseURLOrCustomer === "string"
      ? baseURLOrCustomer
      : process.env.PLAYWRIGHT_ORIGIN || "http://localhost:3001";
  const adminCtx = await browser.newContext({ baseURL, storageState: undefined });
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
      notes: `${customer.productType} E2E enquiry`,
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
