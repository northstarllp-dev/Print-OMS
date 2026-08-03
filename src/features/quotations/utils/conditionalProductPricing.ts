import type { PricingType } from "@/features/quotations/utils/lineAmount";

/** Fallback when a dual-price product has no per-product threshold set. */
export const DEFAULT_UNIT_PRICE_MAX_SQFT = 10;

export type ProductPricingSource = {
  pricing_type?: string | null;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  /** ≤ this sqft → unit price; above → sqft. Set on the product. */
  unit_price_max_sqft?: number | null;
};

export function productHasDualPricing(p: ProductPricingSource): boolean {
  // Need both rates so ≤threshold / >threshold switching never zeros the line.
  return (Number(p.price_per_sqft) || 0) > 0 && (Number(p.price_per_unit) || 0) > 0;
}

export function resolveUnitPriceMaxSqft(p: ProductPricingSource): number {
  const raw = Number(p.unit_price_max_sqft);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_UNIT_PRICE_MAX_SQFT;
}

/** ≤ threshold sq → per_unit; above → per_sqft. */
export function pricingTypeForArea(
  measurement: number,
  maxSqftForUnit: number = DEFAULT_UNIT_PRICE_MAX_SQFT
): PricingType {
  return measurement > maxSqftForUnit ? "per_sqft" : "per_unit";
}

export function getProductPriceForType(
  p: ProductPricingSource,
  type: PricingType
): number {
  if (type === "per_sqft") return Number(p.price_per_sqft) || 0;
  return Number(p.price_per_unit) || 0;
}

/** Catalog-only resolve (single pricing type products). */
export function resolveInitialPricing(p: ProductPricingSource): {
  pricingType: PricingType;
  price: number;
} {
  const ut = (p.pricing_type || "").toLowerCase().trim();

  if (ut === "per sq.ft" || ut === "per sqft" || ut === "sqft" || ut === "per_sqft") {
    return { pricingType: "per_sqft", price: Number(p.price_per_sqft) || 0 };
  }
  if (ut === "per unit" || ut === "per_unit" || ut === "unit" || ut === "nos") {
    return { pricingType: "per_unit", price: Number(p.price_per_unit) || 0 };
  }
  if ((Number(p.price_per_sqft) || 0) > 0) {
    return { pricingType: "per_sqft", price: Number(p.price_per_sqft) || 0 };
  }
  if ((Number(p.price_per_unit) || 0) > 0) {
    return { pricingType: "per_unit", price: Number(p.price_per_unit) || 0 };
  }
  return { pricingType: "per_unit", price: 0 };
}

/**
 * When adding/updating a line: dual/Multiple products switch by product threshold;
 * single-type products keep catalog pricing.
 */
export function resolvePricingForMeasurement(
  p: ProductPricingSource,
  measurement: number
): { pricingType: PricingType; price: number; unit: "sqft" | "nos" } {
  if (productHasDualPricing(p)) {
    const pricingType = pricingTypeForArea(measurement, resolveUnitPriceMaxSqft(p));
    return {
      pricingType,
      price: getProductPriceForType(p, pricingType),
      unit: pricingType === "per_sqft" ? "sqft" : "nos",
    };
  }
  const resolved = resolveInitialPricing(p);
  return {
    pricingType: resolved.pricingType,
    price: resolved.price,
    unit: resolved.pricingType === "per_sqft" ? "sqft" : "nos",
  };
}
