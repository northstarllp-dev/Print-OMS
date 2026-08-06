import { describe, it, expect } from "vitest";
import {
  linearToFeet,
  siteMeasurementAreaSqFt,
  normalizeLinearUnit,
} from "@/features/orders/actions/siteVisitMapper";

describe("site measurement → sq ft for quotation", () => {
  it("normalizes unit aliases", () => {
    expect(normalizeLinearUnit("INCH")).toBe("in");
    expect(normalizeLinearUnit("inches")).toBe("in");
    expect(normalizeLinearUnit("ft")).toBe("ft");
    expect(normalizeLinearUnit("feet")).toBe("ft");
    expect(normalizeLinearUnit("m")).toBe("m");
    expect(normalizeLinearUnit("meter")).toBe("m");
    expect(normalizeLinearUnit("cm")).toBe("cm");
    expect(normalizeLinearUnit("mm")).toBe("mm");
  });

  it("converts linear dimensions to feet", () => {
    expect(linearToFeet(12, "in")).toBe(1);
    expect(linearToFeet(100, "inch")).toBeCloseTo(100 / 12, 6);
    expect(linearToFeet(1, "m")).toBeCloseTo(1 / 0.3048, 6);
    expect(linearToFeet(30.48, "cm")).toBeCloseTo(1, 6);
    expect(linearToFeet(304.8, "mm")).toBeCloseTo(1, 6);
    expect(linearToFeet(5, "ft")).toBe(5);
  });

  it("100 × 100 inch → 69 sq ft (nearest integer)", () => {
    expect(
      siteMeasurementAreaSqFt({
        width: 100,
        height: 100,
        widthUnit: "INCH",
        heightUnit: "INCH",
      })
    ).toBe(69);
  });

  it("10 × 10 ft stays 100 sq ft", () => {
    expect(
      siteMeasurementAreaSqFt({
        width: 10,
        height: 10,
        widthUnit: "ft",
        heightUnit: "ft",
      })
    ).toBe(100);
  });

  it("1 × 1 m → 11 sq ft (nearest integer)", () => {
    expect(
      siteMeasurementAreaSqFt({
        width: 1,
        height: 1,
        widthUnit: "m",
        heightUnit: "m",
      })
    ).toBe(11);
  });

  it("handles mixed units (24 inch × 2 ft = 4 sq ft)", () => {
    expect(
      siteMeasurementAreaSqFt({
        width: 24,
        height: 2,
        widthUnit: "in",
        heightUnit: "ft",
      })
    ).toBe(4);
  });

  it("returns 0 for missing dimensions", () => {
    expect(siteMeasurementAreaSqFt({ width: 100, height: null, widthUnit: "in" })).toBe(0);
    expect(siteMeasurementAreaSqFt(null)).toBe(0);
  });
});
