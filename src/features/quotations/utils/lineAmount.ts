export type PricingType = "per_unit" | "per_sqft";

/** Qty/Measurement for a line — works for both per-unit and per-sqft. */
export function getLineMeasurement(item: {
  quantity?: number | null;
  totalSqFt?: number | null;
}): number {
  const qty = Number(item.quantity) || 0;
  const sqft = Number(item.totalSqFt) || 0;
  // Legacy per_sqft/rft lines stored measurement in totalSqFt with quantity forced to 1
  if (sqft > 0 && qty === 1 && sqft !== 1) return sqft;
  if (qty > 0) return qty;
  return sqft > 0 ? sqft : 0;
}

/** Amount before GST: measurement × rate (unit or sqft — same formula). */
export function calcLineAmount(item: {
  quantity?: number | null;
  totalSqFt?: number | null;
  unitPrice?: number | null;
}): number {
  return getLineMeasurement(item) * (Number(item.unitPrice) || 0);
}

export function normalizePricingType(type?: string | null): PricingType {
  if (type === "per_sqft") return "per_sqft";
  return "per_unit";
}

/** Normalize a saved line: drop running-ft, unify qty/measurement into quantity. */
/** Customer-facing quotation statuses (portal + anon RLS). */
export const CUSTOMER_VISIBLE_QUOTATION_STATUSES = ["Sent", "Approved", "Rejected"] as const;

export function isQuotationVisibleToCustomer(status?: string | null): boolean {
  return CUSTOMER_VISIBLE_QUOTATION_STATUSES.includes(
    status as (typeof CUSTOMER_VISIBLE_QUOTATION_STATUSES)[number]
  );
}

export interface QuotationTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grand_total: number;
}

/** Server-authoritative totals from signage_options (matches QuotationModule formulas). */
export function computeQuotationTotals(
  signageOptions: Array<{ lines?: Array<Record<string, unknown>> }> | null | undefined,
  discount: number,
  shipping: number
): QuotationTotals {
  const sections = signageOptions ?? [];
  const subtotal = sections.reduce((sum, sec) => {
    return sum + (sec.lines ?? []).reduce((s, line) => s + calcLineAmount(line), 0);
  }, 0);
  const totalGst = sections.reduce((sum, sec) => {
    return sum + (sec.lines ?? []).reduce(
      (s, line) => s + calcLineAmount(line) * ((Number(line.gstRate) || 0) / 100),
      0
    );
  }, 0);
  const clampedDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const tax =
    subtotal > 0
      ? Math.round(totalGst * (1 - clampedDiscount / subtotal) * 100) / 100
      : 0;
  const ship = Math.max(0, Number(shipping) || 0);
  const grand_total = Math.round((subtotal - clampedDiscount + tax + ship) * 100) / 100;
  return { subtotal, discount: clampedDiscount, tax, shipping: ship, grand_total };
}

export function normalizeLineItem<T extends Record<string, any>>(line: T): T & {
  pricingType: PricingType;
  quantity: number;
  totalSqFt: number;
  unit: string;
} {
  const measurement = getLineMeasurement(line);
  const pricingType = normalizePricingType(line.pricingType);
  return {
    ...line,
    pricingType,
    quantity: measurement > 0 ? measurement : 1,
    totalSqFt: measurement > 0 ? measurement : 0,
    unit: pricingType === "per_sqft" ? "sqft" : "nos",
  };
}
