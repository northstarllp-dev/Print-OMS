import { buildCustomerMatchOrClauses } from "@/features/enquiries/enquiryFormLogic";

/** Pure convert-to-order helpers (unit-tested). */

export interface ConvertFormInput {
  clientName: string;
  businessName: string;
  productType?: string;
  requirements?: string;
  assignedAdmins?: string[];
}

export function canConvertEnquiry(status?: string | null): boolean {
  return status !== "Converted";
}

/**
 * Server-side duplicate guard — block if already converted or already linked
 * to an order (friendly id or uuid).
 */
export function shouldBlockConvert(enq: {
  status?: string | null;
  order_id?: string | null;
}): boolean {
  return Boolean(enq.order_id) || enq.status === "Converted";
}

export function canSubmitConvertForm(input: ConvertFormInput): boolean {
  return Boolean(input.clientName.trim() && input.businessName.trim());
}

/** Product typeahead filter used by ConvertEnquiryModal. */
export function filterProductsByName<T extends { name: string }>(
  products: T[],
  query: string
): T[] {
  const q = query.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

/** Customer match OR clauses for convert path (escaped). */
export function buildConvertCustomerOrClauses(enq: {
  phone?: unknown;
  whatsapp?: unknown;
  email?: unknown;
}): string[] {
  return buildCustomerMatchOrClauses(enq);
}

export function buildCustomerInsertFromConvert(
  companyId: string,
  enq: {
    phone?: unknown;
    whatsapp?: unknown;
    email?: unknown;
    location?: unknown;
  },
  clientName: string,
  businessName: string
) {
  return {
    company_id: companyId,
    name: businessName || clientName,
    phone: enq.phone,
    whatsapp: enq.whatsapp,
    email: enq.email,
    billing_address: "Address Details Pending Intake",
    shipping_address: (enq.location as string) || "Installation Address Pending Survey",
  };
}

/** Order insert written by convertEnquiryToOrderAction. */
export function buildOrderInsertFromConvert(
  companyId: string,
  customerId: string,
  input: ConvertFormInput,
  customerNameFallback: string
) {
  return {
    company_id: companyId,
    client_name: input.clientName,
    business_name: input.businessName || customerNameFallback,
    customer_id: customerId,
    stage: "Site Visit Pending",
    health: "Active",
    product_type: input.productType || "",
    requirements: input.requirements || "",
    assigned_admins: input.assignedAdmins || [],
  };
}

export function buildEnquiryConvertedUpdate(
  customerId: string,
  orderId: string
): { status: "Converted"; customer_id: string; order_id: string } {
  return {
    status: "Converted",
    customer_id: customerId,
    order_id: orderId,
  };
}

export function orderCreatedIdempotencyKey(friendlyOrderId: string): string {
  return `order_created:${friendlyOrderId}`;
}

/**
 * Double-submit guard for Convert popup Create Order button.
 * Returns whether a new submit may start given current submitting flag.
 */
export function canStartConvertSubmit(isSubmitting: boolean): boolean {
  return !isSubmitting;
}

export function isConvertSubmitDisabled(
  clientName: string,
  businessName: string,
  isSubmitting: boolean
): boolean {
  return !clientName.trim() || !businessName.trim() || isSubmitting;
}
