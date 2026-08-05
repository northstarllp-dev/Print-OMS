import { describe, expect, it } from "vitest";
import {
  financialYearLabel,
  normalizeInvoiceNumbering,
  resolvePeriodKey,
  resolveYearSegment,
  EMPTY_INVOICE_NUMBERING,
} from "@/features/invoices/types/invoiceNumbering";
import {
  calcLineAmount,
  computeQuotationTotals,
  getLineMeasurement,
  normalizeLineItem,
  normalizePricingType,
} from "@/features/quotations/utils/lineAmount";
import {
  DEFAULT_UNIT_PRICE_MAX_SQFT,
  pricingTypeForArea,
  productHasDualPricing,
  resolvePricingForMeasurement,
} from "@/features/quotations/utils/conditionalProductPricing";
import {
  buildTaxSummaryRows,
  flattenQuotationLines,
  type FlatDocLine,
} from "@/features/quotations/utils/quotationDocumentMath";

describe("line measurement & amount", () => {
  it("getLineMeasurement prefers quantity when present", () => {
    expect(getLineMeasurement({ quantity: 5, totalSqFt: 10 })).toBe(5);
  });

  it("getLineMeasurement uses legacy totalSqFt when qty is forced to 1", () => {
    expect(getLineMeasurement({ quantity: 1, totalSqFt: 24 })).toBe(24);
  });

  it("getLineMeasurement falls back to totalSqFt", () => {
    expect(getLineMeasurement({ quantity: 0, totalSqFt: 12 })).toBe(12);
    expect(getLineMeasurement({})).toBe(0);
  });

  it("calcLineAmount multiplies measurement by unit price", () => {
    expect(calcLineAmount({ quantity: 3, unitPrice: 100 })).toBe(300);
    expect(calcLineAmount({ quantity: 1, totalSqFt: 10, unitPrice: 50 })).toBe(500);
    expect(calcLineAmount({ quantity: null, unitPrice: null })).toBe(0);
  });

  it("normalizePricingType defaults unknown values to per_unit", () => {
    expect(normalizePricingType("per_sqft")).toBe("per_sqft");
    expect(normalizePricingType("per_unit")).toBe("per_unit");
    expect(normalizePricingType("weird")).toBe("per_unit");
    expect(normalizePricingType(null)).toBe("per_unit");
  });

  it("normalizeLineItem unifies qty/measurement and unit label", () => {
    const sqft = normalizeLineItem({
      pricingType: "per_sqft",
      quantity: 1,
      totalSqFt: 20,
      unitPrice: 10,
    });
    expect(sqft.quantity).toBe(20);
    expect(sqft.totalSqFt).toBe(20);
    expect(sqft.unit).toBe("sqft");
    expect(sqft.pricingType).toBe("per_sqft");

    const unit = normalizeLineItem({ pricingType: "per_unit", quantity: 0 });
    expect(unit.quantity).toBe(1);
    expect(unit.totalSqFt).toBe(0);
    expect(unit.unit).toBe("nos");
  });
});

describe("conditional product pricing by area", () => {
  const dual = {
    pricing_type: "Multiple",
    price_per_unit: 500,
    price_per_sqft: 80,
    unit_price_max_sqft: 10,
    pricing_type_below: "per_unit",
    pricing_type_above: "per_sqft",
  };

  it("uses product threshold for unit vs sqft pricing", () => {
    expect(DEFAULT_UNIT_PRICE_MAX_SQFT).toBe(10);
    expect(pricingTypeForArea(10, 10)).toBe("per_unit");
    expect(pricingTypeForArea(10.01, 10)).toBe("per_sqft");
    expect(productHasDualPricing(dual)).toBe(true);
    expect(resolvePricingForMeasurement(dual, 8)).toMatchObject({
      pricingType: "per_unit",
      price: 500,
      unit: "nos",
    });
    expect(resolvePricingForMeasurement(dual, 12)).toMatchObject({
      pricingType: "per_sqft",
      price: 80,
      unit: "sqft",
    });
  });

  it("honors a custom per-product threshold", () => {
    const custom = { ...dual, unit_price_max_sqft: 25 };
    expect(resolvePricingForMeasurement(custom, 25)).toMatchObject({
      pricingType: "per_unit",
      price: 500,
    });
    expect(resolvePricingForMeasurement(custom, 26)).toMatchObject({
      pricingType: "per_sqft",
      price: 80,
    });
  });

  it("supports sqft+sqft and unit+unit band combinations", () => {
    const bothSqft = {
      pricing_type: "Multiple",
      price_per_unit: 150,
      price_per_sqft: 120,
      unit_price_max_sqft: 10,
      pricing_type_below: "per_sqft",
      pricing_type_above: "per_sqft",
    };
    expect(resolvePricingForMeasurement(bothSqft, 8)).toMatchObject({
      pricingType: "per_sqft",
      price: 150,
      unit: "sqft",
    });
    expect(resolvePricingForMeasurement(bothSqft, 12)).toMatchObject({
      pricingType: "per_sqft",
      price: 120,
      unit: "sqft",
    });

    const bothUnit = {
      pricing_type: "Multiple",
      price_per_unit: 800,
      price_per_sqft: 600,
      unit_price_max_sqft: 10,
      pricing_type_below: "per_unit",
      pricing_type_above: "per_unit",
    };
    expect(resolvePricingForMeasurement(bothUnit, 5)).toMatchObject({
      pricingType: "per_unit",
      price: 800,
      unit: "nos",
    });
    expect(resolvePricingForMeasurement(bothUnit, 15)).toMatchObject({
      pricingType: "per_unit",
      price: 600,
      unit: "nos",
    });
  });

  it("keeps catalog type when only one rate exists", () => {
    expect(
      resolvePricingForMeasurement(
        { pricing_type: "per_sqft", price_per_sqft: 90, price_per_unit: 0 },
        5
      )
    ).toMatchObject({ pricingType: "per_sqft", price: 90 });
  });
});

describe("computeQuotationTotals", () => {
  const sections = [
    {
      lines: [
        { quantity: 2, unitPrice: 100, gstRate: 18 },
        { quantity: 1, unitPrice: 50, gstRate: 18 },
      ],
    },
  ];
  // subtotal = 200 + 50 = 250
  // totalGst = 36 + 9 = 45

  it("computes subtotal, tax, and grand total without discount", () => {
    const totals = computeQuotationTotals(sections, 0, 0);
    expect(totals.subtotal).toBe(250);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBe(45);
    expect(totals.shipping).toBe(0);
    expect(totals.grand_total).toBe(295);
  });

  it("clamps discount to [0, subtotal] and scales GST", () => {
    const totals = computeQuotationTotals(sections, 50, 10);
    // tax = 45 * (1 - 50/250) = 45 * 0.8 = 36
    expect(totals.discount).toBe(50);
    expect(totals.tax).toBe(36);
    expect(totals.shipping).toBe(10);
    expect(totals.grand_total).toBe(246); // 250 - 50 + 36 + 10
  });

  it("clamps oversized discount and negative shipping", () => {
    const totals = computeQuotationTotals(sections, 9999, -5);
    expect(totals.discount).toBe(250);
    expect(totals.tax).toBe(0);
    expect(totals.shipping).toBe(0);
    expect(totals.grand_total).toBe(0);
  });

  it("handles empty/null sections", () => {
    expect(computeQuotationTotals(null, 10, 5)).toEqual({
      subtotal: 0,
      discount: 0,
      tax: 0,
      shipping: 5,
      grand_total: 5,
    });
  });
});

describe("quotation document math", () => {
  it("flattenQuotationLines splits GST into CGST/SGST", () => {
    const rows = flattenQuotationLines(
      [
        {
          itemLabel: "Fascia",
          lines: [{ description: "Vinyl", quantity: 10, unitPrice: 100, gstRate: 18, hsn: "4901" }],
        },
      ],
      "cgst_sgst"
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].preTax).toBe(1000);
    expect(rows[0].cgstRate).toBe(9);
    expect(rows[0].sgstRate).toBe(9);
    expect(rows[0].cgstAmount).toBe(90);
    expect(rows[0].sgstAmount).toBe(90);
    expect(rows[0].igstAmount).toBe(0);
    expect(rows[0].hsn).toBe("4901");
  });

  it("flattenQuotationLines uses IGST when tax split is igst", () => {
    const rows = flattenQuotationLines(
      [{ lines: [{ description: "Board", quantity: 2, unitPrice: 50, gstRate: 18 }] }],
      "igst"
    );
    expect(rows[0].igstRate).toBe(18);
    expect(rows[0].igstAmount).toBe(18);
    expect(rows[0].cgstAmount).toBe(0);
  });

  it("flattenQuotationLines appends section labels when multiple sections", () => {
    const rows = flattenQuotationLines(
      [
        {
          itemLabel: "A",
          lines: [{ description: "Item", quantity: 1, unitPrice: 10 }],
        },
        {
          itemLabel: "B",
          lines: [{ description: "Item", quantity: 1, unitPrice: 20 }],
        },
      ],
      "cgst_sgst"
    );
    expect(rows[0].description).toBe("Item (A)");
    expect(rows[1].description).toBe("Item (B)");
  });

  it("buildTaxSummaryRows aggregates CGST/SGST and applies taxScale", () => {
    const lines: FlatDocLine[] = [
      {
        index: 1,
        description: "A",
        detailLines: [],
        hsn: "",
        qty: 1,
        rate: 100,
        gstRate: 18,
        preTax: 100,
        cgstRate: 9,
        sgstRate: 9,
        cgstAmount: 9,
        sgstAmount: 9,
        igstRate: 0,
        igstAmount: 0,
      },
    ];

    const rows = buildTaxSummaryRows(lines, "cgst_sgst", 0.5);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.label.startsWith("CGST"))?.amount).toBe(4.5);
    expect(rows.find((r) => r.label.startsWith("SGST"))?.amount).toBe(4.5);
  });

  it("buildTaxSummaryRows aggregates IGST", () => {
    const lines: FlatDocLine[] = [
      {
        index: 1,
        description: "A",
        detailLines: [],
        hsn: "",
        qty: 1,
        rate: 100,
        gstRate: 18,
        preTax: 100,
        cgstRate: 0,
        sgstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstRate: 18,
        igstAmount: 18,
      },
    ];
    const rows = buildTaxSummaryRows(lines, "igst");
    expect(rows).toEqual([{ label: "IGST18 (18%)", rate: 18, amount: 18 }]);
  });
});

describe("invoice numbering period calculations", () => {
  const july2026 = new Date(2026, 6, 15); // Jul 15, 2026

  it("financialYearLabel uses start month", () => {
    expect(financialYearLabel(july2026, 4)).toBe("26-27");
    expect(financialYearLabel(new Date(2026, 2, 1), 4)).toBe("25-26"); // Mar → prior FY
  });

  it("resolvePeriodKey respects reset mode", () => {
    const base = { ...EMPTY_INVOICE_NUMBERING };
    expect(resolvePeriodKey({ ...base, reset: "never" }, july2026)).toBe("all");
    expect(resolvePeriodKey({ ...base, reset: "monthly" }, july2026)).toBe("2026-07");
    expect(
      resolvePeriodKey({ ...base, reset: "yearly", yearPart: "calendar" }, july2026)
    ).toBe("2026");
    expect(
      resolvePeriodKey({ ...base, reset: "yearly", yearPart: "financial" }, july2026)
    ).toBe("26-27");
  });

  it("resolveYearSegment returns null when yearPart is none", () => {
    expect(
      resolveYearSegment({ ...EMPTY_INVOICE_NUMBERING, yearPart: "none" }, july2026)
    ).toBeNull();
  });

  it("normalizeInvoiceNumbering fills defaults and clamps values", () => {
    expect(normalizeInvoiceNumbering(null)).toEqual(EMPTY_INVOICE_NUMBERING);
    const normalized = normalizeInvoiceNumbering({
      prefix: "  PRT  ",
      separator: "//extra",
      yearPart: "bogus",
      financialYearStartMonth: 0,
      startingNumber: -3,
      padding: 99,
      reset: "weekly",
    });
    expect(normalized.prefix).toBe("PRT");
    expect(normalized.separator).toBe("//e");
    expect(normalized.yearPart).toBe("calendar");
    expect(normalized.financialYearStartMonth).toBe(4);
    expect(normalized.startingNumber).toBe(1);
    expect(normalized.padding).toBe(12);
    expect(normalized.reset).toBe("yearly");
  });
});
