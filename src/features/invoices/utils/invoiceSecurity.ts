const ALLOWED_STATUSES = new Set(["Draft", "Sent", "Paid", "Void"]);

const UPSERT_LOCKED_STATUSES = new Set(["Paid", "Void"]);

export const CUSTOMER_VISIBLE_INVOICE_STATUSES = ["Sent", "Paid"] as const;

export const SEND_INVOICE_FROM_STATUSES = new Set(["Draft", "Sent"]);

export function isInvoiceVisibleToCustomer(status?: string | null): boolean {
  return CUSTOMER_VISIBLE_INVOICE_STATUSES.includes(
    status as (typeof CUSTOMER_VISIBLE_INVOICE_STATUSES)[number]
  );
}

export function assertValidInvoiceStatus(status: string | undefined): string {
  const value = status || "Draft";
  if (!ALLOWED_STATUSES.has(value)) {
    throw new Error(`Invalid invoice status: ${value}`);
  }
  return value;
}

export function assertUpsertStatusTransition(
  existingStatus: string | undefined,
  nextStatus: string
): void {
  if (nextStatus === "Paid" || nextStatus === "Void") {
    throw new Error(
      `Status "${nextStatus}" cannot be set via save use the workflow action`
    );
  }
  if (existingStatus && UPSERT_LOCKED_STATUSES.has(existingStatus)) {
    throw new Error("Invoice is locked and cannot be edited");
  }
}

export function assertCanSendInvoice(status: string): void {
  if (!SEND_INVOICE_FROM_STATUSES.has(status)) {
    throw new Error(
      `Cannot send invoice in status "${status}". Only Draft or Sent invoices can be sent.`
    );
  }
}

export function sanitizeSignageOptions(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];
  if (input.length > 100) {
    throw new Error("Too many invoice sections");
  }
  return input.map((section) => {
    if (!section || typeof section !== "object") {
      throw new Error("Invalid invoice section");
    }
    const lines = (section as { lines?: unknown }).lines;
    if (lines !== undefined && !Array.isArray(lines)) {
      throw new Error("Invalid invoice line items");
    }
    if (Array.isArray(lines) && lines.length > 200) {
      throw new Error("Too many line items in a section");
    }
    return section as Record<string, unknown>;
  });
}

/** Strip internal fields / hide drafts before customer portal. */
export function toCustomerVisibleInvoice(row: Record<string, unknown> | null) {
  if (!row) return null;
  if (!isInvoiceVisibleToCustomer(row.status as string | undefined)) {
    return null;
  }
  return row;
}
