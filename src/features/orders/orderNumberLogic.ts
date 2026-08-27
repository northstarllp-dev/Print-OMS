/**
 * Pure mirror of DB trigger `generate_order_id`:
 *   NEW.order_id := customer_id || '-' || LPAD((max_id + 1)::text, 3, '0')
 * scoped by customer_id + company_id.
 *
 * Deleting an order does not soft-delete; hard delete removes the row.
 * The next generated number is always MAX(remaining sequence) + 1 for that
 * customer+company middle gaps are NOT reused; only a trailing max gap is.
 */

export function parseOrderSequence(orderId: string | null | undefined): number | null {
  if (!orderId) return null;
  const dash = orderId.lastIndexOf("-");
  if (dash < 0) return null;
  const tail = orderId.slice(dash + 1).replace(/\D/g, "");
  if (!tail) return null;
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? n : null;
}

export function formatOrderId(customerFriendlyId: string, sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  return `${customerFriendlyId}-${String(n).padStart(3, "0")}`;
}

/** Max sequence among remaining orders for a customer (company-scoped). */
export function maxOrderSequence(
  existingOrderIds: Array<string | null | undefined>
): number {
  let max = 0;
  for (const id of existingOrderIds) {
    const seq = parseOrderSequence(id);
    if (seq != null && seq > max) max = seq;
  }
  return max;
}

/**
 * Next friendly order_id after create/delete, matching the INSERT trigger.
 * Pass remaining order_id values for the same customer_id + company_id.
 */
export function nextOrderIdAfterDelete(
  customerFriendlyId: string,
  remainingOrderIds: Array<string | null | undefined>
): string {
  return formatOrderId(customerFriendlyId, maxOrderSequence(remainingOrderIds) + 1);
}

export function nextOrderIdForCreate(
  customerFriendlyId: string,
  existingOrderIds: Array<string | null | undefined>
): string {
  return nextOrderIdAfterDelete(customerFriendlyId, existingOrderIds);
}

/** company_id is required by the trigger before generating order_id. */
export function requiresCompanyIdForOrderNumber(companyId?: string | null): boolean {
  return !companyId;
}
