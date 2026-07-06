import { isQuotationVisibleToCustomer } from "./lineAmount";

const ALLOWED_STATUSES = new Set([
  "Draft",
  "Pending Approval",
  "Sent",
  "Approved",
  "Rejected",
]);

const UPSERT_LOCKED_STATUSES = new Set(["Sent", "Approved"]);

/** Statuses that may only be set by dedicated workflow actions, not upsertQuotation. */
const UPSERT_FORBIDDEN_TARGET_STATUSES = new Set(["Approved", "Rejected"]);

/** Admin may send to customer only after staff review or customer revision. */
export const SEND_TO_CUSTOMER_FROM_STATUSES = new Set(["Pending Approval", "Rejected"]);

export function assertValidQuotationStatus(status: string | undefined): string {
  const value = status || "Draft";
  if (!ALLOWED_STATUSES.has(value)) {
    throw new Error(`Invalid quotation status: ${value}`);
  }
  return value;
}

export function assertQuotationEditable(existingStatus: string | undefined): void {
  if (existingStatus && UPSERT_LOCKED_STATUSES.has(existingStatus)) {
    throw new Error("Quotation is locked and cannot be edited");
  }
}

export function assertCanSendQuotationToCustomer(status: string): void {
  if (!SEND_TO_CUSTOMER_FROM_STATUSES.has(status)) {
    throw new Error(
      `Cannot send quotation in status "${status}". Submit for review or wait for customer revision.`
    );
  }
}

export function assertUpsertStatusTransition(
  existingStatus: string | undefined,
  nextStatus: string
): void {
  if (UPSERT_FORBIDDEN_TARGET_STATUSES.has(nextStatus)) {
    throw new Error(`Status "${nextStatus}" cannot be set via save — use the workflow action`);
  }
  if (existingStatus && UPSERT_LOCKED_STATUSES.has(existingStatus)) {
    throw new Error("Quotation is locked and cannot be edited");
  }
}

export function sanitizeSignageOptions(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];
  if (input.length > 100) {
    throw new Error("Too many quotation sections");
  }
  return input.map((section) => {
    if (!section || typeof section !== "object") {
      throw new Error("Invalid quotation section");
    }
    const lines = (section as { lines?: unknown }).lines;
    if (lines !== undefined && !Array.isArray(lines)) {
      throw new Error("Invalid quotation line items");
    }
    if (Array.isArray(lines) && lines.length > 200) {
      throw new Error("Too many line items in a section");
    }
    return section as Record<string, unknown>;
  });
}

/** Strip internal quotation fields before sending to the customer portal. */
export function toCustomerVisibleQuotation(row: Record<string, unknown> | null) {
  if (!row) return null;
  if (!isQuotationVisibleToCustomer(row.status as string | undefined)) {
    return null;
  }
  return row;
}
