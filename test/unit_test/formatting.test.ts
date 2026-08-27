import { describe, expect, it } from "vitest";
import { formatGpsCoords } from "@/components/maps/mapsUrl";
import {
  EMPTY_INVOICE_NUMBERING,
  formatInvoiceNumber,
  previewInvoiceNumber,
} from "@/features/invoices/types/invoiceNumbering";
import {
  formatInstallmentName,
  nextInstallmentName,
} from "@/features/payments/utils/installmentName";
import {
  amountToIndianWords,
  formatInr,
  formatQuoteDate,
  parseTermsLines,
} from "@/features/quotations/utils/amountInWords";

describe("amountToIndianWords", () => {
  it("handles zero and absolute value", () => {
    expect(amountToIndianWords(0)).toBe("Zero Only");
    expect(amountToIndianWords(-5)).toBe("Five Only");
  });

  it("converts tens and hundreds", () => {
    expect(amountToIndianWords(19)).toBe("Nineteen Only");
    expect(amountToIndianWords(42)).toBe("Forty Two Only");
    expect(amountToIndianWords(105)).toBe("One Hundred Five Only");
  });

  it("converts thousands, lakhs, and crores", () => {
    expect(amountToIndianWords(2500)).toBe("Two Thousand Five Hundred Only");
    expect(amountToIndianWords(125000)).toBe("One Lakh Twenty Five Thousand Only");
    expect(amountToIndianWords(10000000)).toBe("One Crore Only");
  });

  it("rounds fractional amounts", () => {
    expect(amountToIndianWords(1.4)).toBe("One Only");
    expect(amountToIndianWords(1.6)).toBe("Two Only");
  });
});

describe("formatInr", () => {
  it("formats with two decimal places in en-IN", () => {
    expect(formatInr(1234.5)).toBe("1,234.50");
    expect(formatInr(0)).toBe("0.00");
    expect(formatInr(Number.NaN)).toBe("0.00");
  });
});

describe("formatQuoteDate", () => {
  it("returns em dash for empty/invalid values", () => {
    expect(formatQuoteDate(null)).toBe("");
    expect(formatQuoteDate("")).toBe("");
    expect(formatQuoteDate("not-a-date")).toBe("");
    expect(formatQuoteDate(new Date(Number.NaN))).toBe("");
  });

  it("formats Date and ISO strings in en-IN style", () => {
    const formatted = formatQuoteDate(new Date(2026, 6, 15));
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/2026/);

    const fromIso = formatQuoteDate("2026-07-15");
    expect(fromIso).toMatch(/15/);
    expect(fromIso).toMatch(/2026/);
  });

  it("normalizes Postgres-style timestamps", () => {
    const formatted = formatQuoteDate("2026-07-15 10:30:00+00");
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/2026/);
  });
});

describe("parseTermsLines", () => {
  it("splits and trims non-empty lines", () => {
    expect(parseTermsLines(null)).toEqual([]);
    expect(parseTermsLines("  ")).toEqual([]);
    expect(parseTermsLines("One\n\nTwo\r\n  Three  ")).toEqual(["One", "Two", "Three"]);
  });
});

describe("installment name formatting", () => {
  it("formatInstallmentName uses correct ordinals", () => {
    expect(formatInstallmentName(1)).toBe("1st installment");
    expect(formatInstallmentName(2)).toBe("2nd installment");
    expect(formatInstallmentName(3)).toBe("3rd installment");
    expect(formatInstallmentName(4)).toBe("4th installment");
    expect(formatInstallmentName(11)).toBe("11th installment");
    expect(formatInstallmentName(12)).toBe("12th installment");
    expect(formatInstallmentName(13)).toBe("13th installment");
    expect(formatInstallmentName(21)).toBe("21st installment");
  });

  it("nextInstallmentName is 1-based from existing count", () => {
    expect(nextInstallmentName(0)).toBe("1st installment");
    expect(nextInstallmentName(2)).toBe("3rd installment");
    expect(nextInstallmentName(-5)).toBe("1st installment");
  });
});

describe("invoice number formatting", () => {
  const date = new Date(2026, 6, 15);

  it("formatInvoiceNumber joins prefix, year, and padded sequence", () => {
    expect(
      formatInvoiceNumber(
        { ...EMPTY_INVOICE_NUMBERING, prefix: "INV", separator: "-", yearPart: "calendar", padding: 6 },
        42,
        date
      )
    ).toBe("INV-2026-000042");
  });

  it("omits year when yearPart is none", () => {
    expect(
      formatInvoiceNumber(
        { ...EMPTY_INVOICE_NUMBERING, yearPart: "none", padding: 3 },
        7,
        date
      )
    ).toBe("INV-007");
  });

  it("uses financial year segment when configured", () => {
    expect(
      formatInvoiceNumber(
        {
          ...EMPTY_INVOICE_NUMBERING,
          yearPart: "financial",
          financialYearStartMonth: 4,
          separator: "/",
          padding: 4,
        },
        1,
        date
      )
    ).toBe("INV/26-27/0001");
  });

  it("previewInvoiceNumber uses startingNumber", () => {
    expect(
      previewInvoiceNumber(
        { ...EMPTY_INVOICE_NUMBERING, startingNumber: 100, padding: 4, yearPart: "none" },
        date
      )
    ).toBe("INV-0100");
  });
});

describe("formatGpsCoords", () => {
  it("formats to 6 decimal places", () => {
    expect(formatGpsCoords(12.9715987, 77.5945627)).toBe("12.971599, 77.594563");
  });
});
