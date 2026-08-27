import type { PricingType } from "@/features/quotations/utils/lineAmount";

/** Fallback when a Multiple product has no per-product threshold set. */
export const DEFAULT_UNIT_PRICE_MAX_SQFT = 10;

export type ProductPricingSource = {
  pricing_type?: string | null;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  /** ≤ this sqft → below band; above → above band. */
  unit_price_max_sqft?: number | null;
  /** Billing type for ≤ threshold (Multiple). Defaults to per_unit. */
  pricing_type_below?: string | null;
  /** Billing type for > threshold (Multiple). Defaults to per_sqft. */
  pricing_type_above?: string | null;
};

export function normalizeBandPricingType(
  value?: string | null,
  fallback: PricingType = "per_unit"
): PricingType {
  const v = (value || "").toLowerCase().trim();
  if (v === "per_sqft" || v === "per sq.ft" || v === "per sqft" || v === "sqft") {
    return "per_sqft";
  }
  if (v === "per_unit" || v === "per unit" || v === "unit" || v === "nos") {
    return "per_unit";
  }
  return fallback;
}

export function isMultiplePricingType(pricingType?: string | null): boolean {
  return (pricingType || "").toLowerCase().trim() === "multiple";
}

/** Both band amounts present (legacy dual / Multiple). */
export function productHasDualPricing(p: ProductPricingSource): boolean {
  return (Number(p.price_per_sqft) || 0) > 0 && (Number(p.price_per_unit) || 0) > 0;
}

export function resolveUnitPriceMaxSqft(p: ProductPricingSource): number {
  const raw = Number(p.unit_price_max_sqft);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_UNIT_PRICE_MAX_SQFT;
}

/** @deprecated Prefer resolvePricingForMeasurement kept for tests of threshold side. */
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
 * Multiple / dual products: pick below or above band by threshold.
 * Each band has its own amount + billing type (unit×unit, sqft×sqft, mixed OK).
 * Single-type products keep catalog pricing.
 */
export function resolvePricingForMeasurement(
  p: ProductPricingSource,
  measurement: number
): { pricingType: PricingType; price: number; unit: "sqft" | "nos" } {
  const useBands =
    isMultiplePricingType(p.pricing_type) || productHasDualPricing(p);

  if (useBands && productHasDualPricing(p)) {
    const useAbove = measurement > resolveUnitPriceMaxSqft(p);
    const pricingType = useAbove
      ? normalizeBandPricingType(p.pricing_type_above, "per_sqft")
      : normalizeBandPricingType(p.pricing_type_below, "per_unit");
    const price = useAbove
      ? Number(p.price_per_sqft) || 0
      : Number(p.price_per_unit) || 0;
    return {
      pricingType,
      price,
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
